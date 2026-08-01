import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Given, Then, When } from "@cucumber/cucumber";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBootstrapResponse } from "../../app/api/bootstrap/route.ts";
import { OperationsView } from "../../components/app/operations-view.tsx";

const demoRuntime = {
  mode: "demo",
  dataSource: "demo",
  host: "127.0.0.1",
  lanEnabled: false,
  readOnly: true,
};

const localRuntime = {
  mode: "local",
  dataSource: "local-d1",
  host: "127.0.0.1",
  lanEnabled: false,
  readOnly: false,
};

function emptyDatabase() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { count: 0 }; },
        async run() { return { success: true }; },
      };
    },
  };
}

When("I request the demo bootstrap", async function () {
  this.response = await createBootstrapResponse(demoRuntime, "gherkin-demo");
  this.body = await this.response.json();
});

Then("the bootstrap is explicitly read-only demo data", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.body.data.mode, "demo");
  assert.equal(this.body.data.source, "demo");
  assert.equal(this.body.data.readOnly, true);
});

Then("the bootstrap contains the isolated demo metrics", function () {
  assert.deepEqual(this.body.data.metrics, {
    revenueMinor: 243000,
    settledMinor: 221000,
    pendingMinor: 22000,
  });
});

When("I request the bootstrap for an empty local database", async function () {
  this.response = await createBootstrapResponse(localRuntime, "gherkin-local", emptyDatabase());
  this.body = await this.response.json();
});

Then("the bootstrap requires onboarding", function () {
  assert.equal(this.response.status, 200);
  assert.equal(this.body.data.mode, "local");
  assert.equal(this.body.data.needsOnboarding, true);
});

Then("the bootstrap offers Feishu, file import, and manual creation", function () {
  assert.deepEqual(this.body.data.actions, ["connect-feishu", "import-file", "create-manually"]);
});

Then("the bootstrap contains no financial metrics", function () {
  assert.equal(this.body.data.metrics, null);
});

Given("the operations view is rendered for income management", function () {
  this.html = renderToStaticMarkup(
    React.createElement(OperationsView, {
      data: {
        mode: "demo",
        source: "demo",
        readOnly: true,
        needsOnboarding: false,
        counts: { accounts: 6, contents: 139 },
        metrics: { revenueMinor: 243000, settledMinor: 221000, pendingMinor: 22000 },
        actions: [],
      },
      activePage: "finance",
    }),
  );
});

Then("the operations navigation exposes every confirmed module", function () {
  for (const label of ["经营总览", "内容日历", "内容库", "收入管理", "账号资产", "复盘实验", "数据导入与同步", "设置"]) {
    assert.match(this.html, new RegExp(label));
  }
});

Then("income management is the current page", function () {
  assert.match(this.html, /aria-current="page"[^>]*>收入管理/);
});

Given("the responsive stylesheet is loaded", async function () {
  this.css = await readFile(new URL("../../app/globals.css", import.meta.url), "utf8");
});

Then("a 767 pixel mobile breakpoint exists", function () {
  assert.match(this.css, /@media\s*\(max-width:\s*767px\)/);
});

Then("the former 1024 pixel minimum width is absent", function () {
  assert.doesNotMatch(this.css, /min-width:\s*1024px/);
});

Then("operations touch targets have a 44 pixel minimum height", function () {
  assert.match(this.css, /\.onboarding-action\s*\{[^}]*min-height:\s*132px/s);
  assert.match(this.css, /\.operations-mobile-nav button\s*\{[^}]*min-height:\s*56px/s);
});
