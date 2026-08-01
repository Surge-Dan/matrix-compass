import type { BootstrapData } from "../../lib/application/get-bootstrap";

const ACTION_LABELS: Record<BootstrapData["actions"][number], string> = {
  "connect-feishu": "连接飞书",
  "import-file": "导入 Excel / CSV",
  "create-manually": "手动创建第一条记录",
};

const ACTION_COPY: Record<BootstrapData["actions"][number], string> = {
  "connect-feishu": "首次全量迁移，后续只读增量同步。",
  "import-file": "先预览、校验和去重，再确认写入。",
  "create-manually": "从一个账号或一条内容开始使用。",
};

export function EmptyState({
  actions,
  onAction,
}: {
  actions: BootstrapData["actions"];
  onAction(action: BootstrapData["actions"][number]): void;
}) {
  return (
    <section className="operations-empty" aria-labelledby="onboarding-title">
      <p className="operations-eyebrow">REAL DATA FIRST</p>
      <h1 id="onboarding-title">先接入你的真实经营数据</h1>
      <p className="operations-empty-copy">
        正式模式不会自动填充演示指标。请选择一种方式，把账号、内容和收入带进本地经营库。
      </p>
      <div className="onboarding-actions">
        {actions.map((action, index) => (
          <button
            className={index === 0 ? "onboarding-action is-primary" : "onboarding-action"}
            type="button"
            key={action}
            onClick={() => onAction(action)}
          >
            <strong>{ACTION_LABELS[action]}</strong>
            <span>{ACTION_COPY[action]}</span>
          </button>
        ))}
      </div>
      <p className="operations-privacy">数据默认只保存在当前电脑，导入前会先创建备份。</p>
    </section>
  );
}
