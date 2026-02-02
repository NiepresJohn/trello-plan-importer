import TaskPlanner from "./components/TaskPlanner";

export default function HomePage() {
  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Draft -&gt; Review -&gt; Commit</p>
          <h1>Trello Plan Importer</h1>
          <p className="lead">
            Plan smarter. Review clearly. Commit confidently. Paste a structured JSON plan, edit it safely,
            and push to Trello only after explicit approval.
          </p>
        </div>
      </header>
      <TaskPlanner />
    </main>
  );
}
