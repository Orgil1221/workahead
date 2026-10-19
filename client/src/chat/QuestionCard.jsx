import MathText from '../components/MathText.jsx';
import { ChatIcon } from './ChatUI.jsx';

export default function QuestionCard({ question, children }) {
  return <article className="ch-shared-question" aria-label="Хуваалцах асуулт">
    <header className="ch-question-card-heading"><span><ChatIcon name="book" size={16} />АСУУЛТ</span>{Number.isFinite(question.points) && <span>{question.points} оноо</span>}</header>
    <div className="ch-question-card-body">
      <p className="ch-question-source">{question.examTitle}{question.year ? ` · ${question.year}` : ''}</p>
      {question.topic && <p className="ch-question-topic">{question.topic}</p>}
      <div className="ch-question-math"><MathText text={question.prompt} /></div>
      {Array.isArray(question.choices) && question.choices.length > 0 && <div className="ch-question-choices">{question.choices.map((choice) => <div className="ch-question-choice" key={choice.key}><b>{choice.key}</b><div><MathText text={choice.text} /></div></div>)}</div>}
    </div>
    {children && <footer className="ch-question-card-footer">{children}</footer>}
  </article>;
}
