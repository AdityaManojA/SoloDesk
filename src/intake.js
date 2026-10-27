import { rid, today } from './lib.js';

export function createIntakeBrief(workspace, { clientId, projectId = '', title = 'Project Brief & Questionnaire', questions = [] } = {}) {
  if (!workspace.docs) workspace.docs = [];
  const defaultQuestions = questions.length ? questions : [
    { id: rid(), question: 'What is the primary objective of this project?', answer: '' },
    { id: rid(), question: 'What are your target deadlines and milestones?', answer: '' },
    { id: rid(), question: 'Are there any existing brand assets, links, or inspiration files?', answer: '' }
  ];
  const brief = {
    id: rid(),
    kind: 'brief',
    title,
    client: clientId,
    project: projectId,
    status: 'In review',
    createdAt: today(),
    questions: defaultQuestions
  };
  workspace.docs.push(brief);
  return brief;
}

export function submitBriefAnswers(workspace, briefId, answers) {
  const brief = (workspace.docs || []).find(d => d.id === briefId);
  if (!brief || brief.kind !== 'brief') throw new Error('Brief questionnaire not found.');
  for (const q of brief.questions || []) {
    if (answers[q.id] !== undefined) {
      q.answer = String(answers[q.id]).trim();
    }
  }
  brief.submittedAt = new Date().toISOString();
  brief.status = 'Approved';
  return brief;
}
