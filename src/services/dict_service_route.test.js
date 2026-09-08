const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "dict_service.js"), "utf8");

function loadDictService(response = {}) {
  const calls = [];
  const values = new Map();
  const SubSync = {
    apiClient: {
      async request(endpoint, options) {
        calls.push({ endpoint, options });
        return response;
      }
    }
  };
  const sessionStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  const context = {
    console,
    sessionStorage,
    window: { __SubSync: SubSync }
  };
  context.__SubSync = SubSync;
  vm.runInNewContext(source, context, { filename: "dict_service.js" });
  return { dictService: SubSync.dictService, calls };
}

test("uses the backend dictionary route for hover and detail lookups", async () => {
  const response = { word: "honest", meanings: ["정직한"] };
  const { dictService, calls } = loadDictService(response);

  await dictService.getHoverMeaning(" Honest ");
  await dictService.getDetailMeaning(" Honest ", "Be honest with yourself.");

  assert.equal(calls[0].endpoint, "/dictionary/hover?word=honest");
  assert.equal(
    calls[1].endpoint,
    "/dictionary/detail?word=honest&context=Be%20honest%20with%20yourself."
  );
});
