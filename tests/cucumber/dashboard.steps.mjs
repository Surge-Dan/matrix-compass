import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Given, Then, When } from "@cucumber/cucumber";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as getDashboard } from "../../app/api/dashboard/route.ts";
import { GET as getHealth } from "../../app/api/health/route.ts";
import { DashboardView } from "../../components/dashboard/dashboard-view.tsx";
import { getDashboardData } from "../../lib/dashboard-data.ts";

Given("the demo backend is healthy", async function () {
  const response = await getHealth();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

When("I request the dashboard without a range", async function () {
  this.response = await getDashboard(
    new Request("http://localhost/api/dashboard"),
  );
  this.body = await this.response.json();
});

When("I request the dashboard for {int} days", async function (range) {
  this.response = await getDashboard(
    new Request(`http://localhost/api/dashboard?range=${range}`),
  );
  this.body = await this.response.json();
});

Then("the response uses the {int} day range", function (range) {
  assert.equal(this.response.status, 200);
  assert.equal(this.body.meta.range, range);
});

Then("the response is explicitly marked as demo data", function () {
  assert.equal(this.body.meta.source, "demo");
});

Then("the response contains four summary metrics", function () {
  assert.equal(this.body.summary.length, 4);
});

Then("the response status is {int}", function (status) {
  assert.equal(this.response.status, status);
});

Then("the response error code is {string}", function (code) {
  assert.equal(this.body.error.code, code);
});

Given("the dashboard view is rendered for account management", function () {
  this.html = renderToStaticMarkup(
    React.createElement(DashboardView, {
      data: getDashboardData(30, "gherkin-view"),
      activePage: "accounts",
      range: 30,
      menuOpen: false,
      refreshing: false,
      onNavigate() {},
      onRangeChange() {},
      onMenuToggle() {},
    }),
  );
});

Then("the primary navigation exposes every confirmed module", function () {
  for (const label of [
    "数据总览",
    "账号管理",
    "作品监控",
    "粉丝分析",
    "互动分析",
    "异常预警",
    "系统 / API 设置",
  ]) {
    assert.match(this.html, new RegExp(label.replace("/", "\\/")));
  }
});

Then("account management is the current page", function () {
  assert.match(this.html, /aria-current="page"[^>]*>[^<]*账号管理/);
});

Given("the responsive stylesheet is loaded", async function () {
  this.css = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );
});

Then("a 767 pixel mobile breakpoint exists", function () {
  assert.match(this.css, /@media\s*\(max-width:\s*767px\)/);
});

Then("the former 1024 pixel minimum width is absent", function () {
  assert.doesNotMatch(this.css, /min-width:\s*1024px/);
});

Then("touch targets have a 44 pixel minimum height", function () {
  assert.match(this.css, /min-height:\s*44px/);
});
