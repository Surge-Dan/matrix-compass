import type { DashboardData, TrendPoint } from "../../lib/dashboard-data";
import { formatChange, formatMetricValue } from "../../lib/dashboard-format";

function trendPath(points: TrendPoint[], key: "followers" | "growth") {
  const values = points.map((point) => point[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 88 - ((point[key] - min) / span) * 70;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <figure className="trend-chart" aria-labelledby="trend-title">
      <figcaption className="sr-only">
        统计周期内总粉丝与净增粉均呈上升趋势。
      </figcaption>
      <div className="chart-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="trend-line trend-line-primary" d={trendPath(points, "followers")} />
        <path className="trend-line trend-line-secondary" d={trendPath(points, "growth")} />
      </svg>
      <div className="chart-axis" aria-hidden="true">
        {points.map((point, index) =>
          index === 0 || index === points.length - 1 || index % 2 === 0 ? (
            <span key={`${point.label}-${index}`}>{point.label}</span>
          ) : null,
        )}
      </div>
    </figure>
  );
}

export function OverviewPage({ data, onNavigate }: { data: DashboardData; onNavigate(page: "alerts" | "content"): void }) {
  const alert = data.alerts[0];
  return (
    <>
      <section className="hero-row" aria-labelledby="overview-title">
        <div>
          <p className="eyebrow">Good afternoon, Daniel</p>
          <h1 id="overview-title">今天，内容仍在生长。</h1>
          <p className="hero-copy">
            聚合 {data.meta.accountCount} 个账号的经营脉搏，最后更新于 10:32
          </p>
        </div>
      </section>

      {alert ? (
        <section className="alert-ribbon" aria-label="指标预警">
          <span className="alert-direction" aria-hidden="true">△</span>
          <div>
            <strong>{alert.title}</strong>
            <span>{alert.description}</span>
          </div>
          <button type="button" className="text-action" onClick={() => onNavigate("alerts")}>查看预警</button>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="核心指标">
        {data.summary.map((metric) => (
          <article className={`metric-card metric-${metric.id}`} key={metric.id}>
            <p>{metric.label}</p>
            <strong>{formatMetricValue(metric.value, metric.format)}</strong>
            <span className={metric.change < 0 ? "metric-down" : "metric-up"}>
              {metric.change < 0 ? "↘" : "↗"} {formatChange(metric.change)} · {metric.note}
            </span>
          </article>
        ))}
      </section>

      <section className="analysis-grid">
        <article className="surface-card trend-card">
          <header className="card-heading">
            <div>
              <h2 id="trend-title">增长趋势</h2>
              <p>总粉丝与净增粉 · 统一经营口径</p>
            </div>
            <div className="legend" aria-label="图例">
              <span><i className="legend-primary" />总粉丝</span>
              <span><i className="legend-secondary" />净增粉</span>
            </div>
          </header>
          <TrendChart points={data.trend} />
        </article>

        <article className="surface-card platform-card">
          <header className="card-heading">
            <div>
              <h2>平台表现</h2>
              <p>播放 / 阅读贡献占比</p>
            </div>
          </header>
          <div className="platform-list">
            {data.platforms.map((platform) => (
              <div className="platform-row" key={platform.id}>
                <span className={`platform-mark tone-${platform.tone}`}>{platform.shortName}</span>
                <div className="platform-main">
                  <div><strong>{platform.name}</strong><span>{platform.accounts} 个账号</span></div>
                  <div className="share-track"><i style={{ width: `${platform.share}%` }} /></div>
                </div>
                <div className="platform-value">
                  <strong>{platform.share}%</strong>
                  <span>{formatMetricValue(platform.reach, "compact")}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="surface-card works-card">
        <header className="card-heading works-heading">
          <div>
            <h2>近期高表现作品</h2>
            <p>按跨平台标准化热度排序</p>
          </div>
          <button className="text-action" type="button" onClick={() => onNavigate("content")}>查看全部作品</button>
        </header>
        <div className="works-table-wrap">
          <table className="works-table">
            <thead><tr><th>作品</th><th>平台 / 账号</th><th>播放 / 阅读</th><th>互动率</th><th>涨粉转化</th><th>识别</th></tr></thead>
            <tbody>
              {data.works.map((work) => (
                <tr key={work.id}>
                  <td><strong>{work.title}</strong><span>{work.publishedAt} · {work.format}</span></td>
                  <td>{work.platform} · {work.account}</td>
                  <td>{formatMetricValue(work.reach, "integer")}</td>
                  <td>{work.engagementRate.toFixed(2)}%</td>
                  <td>{work.followerConversion.toFixed(2)}%</td>
                  <td><span className="signal-pill">{work.signal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="work-card-list">
            {data.works.map((work) => (
              <article className="work-mobile-card" key={work.id}>
                <div className="work-mobile-top"><span>{work.platform}</span><span className="signal-pill">{work.signal}</span></div>
                <h3>{work.title}</h3>
                <p>{work.account} · {work.publishedAt}</p>
                <dl>
                  <div><dt>播放 / 阅读</dt><dd>{formatMetricValue(work.reach, "integer")}</dd></div>
                  <div><dt>互动率</dt><dd>{work.engagementRate.toFixed(2)}%</dd></div>
                  <div><dt>涨粉转化</dt><dd>{work.followerConversion.toFixed(2)}%</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
