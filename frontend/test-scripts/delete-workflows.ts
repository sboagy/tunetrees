import axios from "axios";

// to run this script:
//   npx tsc delete-workflows.ts
//   node delete-workflows.js
//
// Note I just ended up using the bash script in the scripts
// directory to delete the workflows.

const GITHUB_TOKEN = process.env.GITTHUB_TOKEN;
const OWNER = process.env.GITT_OWNER;
const REPO = process.env.GITTHUB_REPO;

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

interface IWorkflowRun {
  id: number;
}

async function getWorkflowRuns(): Promise<IWorkflowRun[]> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs`;
  const response = await axios.get<{ workflow_runs: IWorkflowRun[] }>(url, {
    headers,
  });
  return response.data.workflow_runs;
}

async function deleteWorkflowRun(runId: number): Promise<void> {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`;
  await axios.delete(url, { headers });
  console.log(`Deleted workflow run: ${runId}`);
}

async function deleteAllWorkflowRuns(): Promise<void> {
  const runs = await getWorkflowRuns();
  for (const run of runs) {
    await deleteWorkflowRun(run.id);
  }
}

deleteAllWorkflowRuns().catch(console.error);
