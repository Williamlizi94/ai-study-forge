from __future__ import annotations

import json
from typing import Any

from openai import OpenAI

from backend.app.config import settings
from backend.app.schemas import ChatMessage


class AIConfigurationError(RuntimeError):
    pass


class AIService:
    def __init__(self) -> None:
        self.model = settings.openai_model
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        if not settings.openai_api_key:
            raise AIConfigurationError("OPENAI_API_KEY is not configured")
        if self._client is None:
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    def _create_text_response(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.responses.create(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        output_text = getattr(response, "output_text", "")
        if output_text:
            return output_text.strip()
        raise RuntimeError("The AI response did not include output text")

    def generate_summary(self, source_text: str) -> str:
        if settings.mock_ai:
            return _mock_summary(source_text)

        return self._create_text_response(
            (
                "You are an expert study assistant for technical courses. "
                "Explain material clearly and accurately, using the source notes as truth."
            ),
            (
                "Create a concise study summary from the notes below. "
                "Use short sections and focus on concepts a student must understand.\n\n"
                "Special rule for homework, exam, worksheet, or solution documents: "
                "if the notes contain numbered questions/problems with answers or solution steps, "
                "summarize problem-by-problem. Do not copy the full problem statement or full solution. "
                "For each problem, keep only the essential information and write this structure:\n"
                "### Problem <number>: <short topic name>\n"
                "- Condensed problem: inputs, goal, constraints, and what must be proven/computed.\n"
                "- Core method: the algorithm, theorem, recurrence, proof technique, or design pattern used.\n"
                "- Key process: 3-6 compressed steps that preserve the important reasoning, formulas, "
                "recurrences, pseudocode idea, or proof logic.\n"
                "- Final result: final answer, runtime/space, proof conclusion, or output if present.\n"
                "- How to think: key insight, pattern recognition cue, and common pitfall for this problem.\n\n"
                "If the notes are ordinary lecture notes instead, summarize normally. "
                "Preserve important mathematical notation and keep the output in the same language as the source.\n\n"
                f"NOTES:\n{source_text}"
            ),
        )

    def generate_cheat_sheet(self, source_text: str) -> str:
        if settings.mock_ai:
            return _mock_cheat_sheet(source_text)

        return self._create_text_response(
            (
                "You create compact, exam-ready cheat sheets for students. "
                "Use the source notes as truth and avoid inventing missing details."
            ),
            (
                "Create a high-signal cheat sheet from the notes below. "
                "Organize it with concise headings, definitions, formulas or rules when relevant, "
                "common mistakes, and quick memory cues. Keep it dense and scannable.\n\n"
                "Special rule for homework, exam, worksheet, or solution documents: "
                "if the notes contain numbered questions/problems with answers or solution steps, "
                "organize the cheat sheet by problem. Do not copy full problem statements or full solutions. "
                "For each problem, write a compact block with:\n"
                "### Q<number>: <short topic name>\n"
                "- Problem type: what kind of problem this is.\n"
                "- Minimal setup: variables, inputs, constraints, and goal.\n"
                "- Solution template: the shortest reusable version of the main steps.\n"
                "- Key formula/recurrence/proof move: include only the formulas or logic needed to reproduce the answer.\n"
                "- Complexity/result: runtime, space, final value, or conclusion if present.\n"
                "- Thinking notes: how to recognize the pattern, what idea unlocks it, and what mistake to avoid.\n\n"
                "For algorithm questions, prioritize subproblem definition, base case, recurrence, evaluation order, "
                "final output, pseudocode idea, and runtime. Preserve important math notation and keep the output "
                "in the same language as the source.\n\n"
                f"NOTES:\n{source_text}"
            ),
        )

    def generate_flashcards(self, source_text: str) -> list[dict[str, str]]:
        if settings.mock_ai:
            return _mock_flashcards(source_text)

        text = self._create_text_response(
            "You create accurate study flashcards. Return only valid JSON.",
            (
                "Create 8 to 12 flashcards from the notes below. "
                "Return exactly this JSON shape: "
                '{"flashcards":[{"question":"...","answer":"..."}]}.\n\n'
                f"NOTES:\n{source_text}"
            ),
        )
        payload = _parse_json_payload(text)
        flashcards = payload.get("flashcards", [])
        return [
            {
                "question": str(item.get("question", "")).strip(),
                "answer": str(item.get("answer", "")).strip(),
            }
            for item in flashcards
            if item.get("question") and item.get("answer")
        ][:12]

    def generate_quiz(self, source_text: str) -> list[dict[str, Any]]:
        if settings.mock_ai:
            return _mock_quiz(source_text)

        text = self._create_text_response(
            "You create accurate practice quizzes. Return only valid JSON.",
            (
                "Create 5 multiple-choice questions from the notes below. "
                "Each question must have exactly 4 choices. "
                'The "answer" value must exactly match one of the four choices. '
                "Return exactly this JSON shape: "
                '{"questions":[{"question":"...","choices":["...","...","...","..."],'
                '"answer":"...","explanation":"..."}]}.\n\n'
                f"NOTES:\n{source_text}"
            ),
        )
        payload = _parse_json_payload(text)
        questions = payload.get("questions", [])
        clean_questions: list[dict[str, Any]] = []
        for item in questions:
            choices = [str(choice).strip() for choice in item.get("choices", []) if str(choice).strip()]
            if len(choices) != 4:
                continue
            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()
            explanation = str(item.get("explanation", "")).strip()
            if question and answer and explanation:
                clean_questions.append(
                    {
                        "question": question,
                        "choices": choices,
                        "answer": answer,
                        "explanation": explanation,
                    }
                )
        return clean_questions[:5]

    def generate_diagnostic(self, source_text: str) -> list[dict[str, Any]]:
        if settings.mock_ai:
            return _mock_diagnostic(source_text)

        text = self._create_text_response(
            (
                "You create diagnostic tests for exam preparation. "
                "Return only valid JSON and use the source notes as truth."
            ),
            (
                "Create 8 multiple-choice diagnostic questions from the notes below. "
                "The goal is to identify weak topics before studying, not to make a generic quiz. "
                "Cover the main concepts, formulas, algorithms, proof patterns, and common traps. "
                "Mix easy, medium, and hard questions. Each question must have exactly 4 choices. "
                'The "answer" value must exactly match one of the four choices. '
                "Each explanation should teach the key idea in 1-3 sentences. "
                "Return exactly this JSON shape: "
                '{"questions":[{"topic":"...","difficulty":"easy|medium|hard",'
                '"question":"...","choices":["...","...","...","..."],'
                '"answer":"...","explanation":"..."}]}.\n\n'
                f"NOTES:\n{source_text}"
            ),
        )
        payload = _parse_json_payload(text)
        questions = payload.get("questions", [])
        clean_questions: list[dict[str, Any]] = []
        for item in questions:
            choices = [str(choice).strip() for choice in item.get("choices", []) if str(choice).strip()]
            if len(choices) != 4:
                continue
            topic = str(item.get("topic", "")).strip() or "General"
            difficulty = str(item.get("difficulty", "medium")).strip().lower()
            if difficulty not in {"easy", "medium", "hard"}:
                difficulty = "medium"
            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()
            explanation = str(item.get("explanation", "")).strip()
            if question and answer and explanation:
                clean_questions.append(
                    {
                        "topic": topic[:80],
                        "difficulty": difficulty,
                        "question": question,
                        "choices": choices,
                        "answer": answer,
                        "explanation": explanation,
                    }
                )
        return clean_questions[:8]

    def explain_quiz_mistakes(
        self,
        source_text: str,
        incorrect_items: list[dict[str, str]],
    ) -> str:
        if settings.mock_ai:
            return _mock_quiz_review(incorrect_items)

        if not incorrect_items:
            return (
                "All submitted answers are correct. Review the explanations once more, "
                "then try creating a new quiz to test retention from a different angle."
            )

        mistakes = json.dumps(incorrect_items, ensure_ascii=False, indent=2)
        return self._create_text_response(
            (
                "You are an AI tutor. Explain mistakes clearly, connect each error to the "
                "underlying knowledge point, and give the student concrete next steps."
            ),
            (
                "The student answered these quiz questions incorrectly. "
                "Use the source notes as the source of truth. "
                "For each mistake, explain why the selected answer is wrong, why the correct "
                "answer is right, and what knowledge point to review. End with a short study plan.\n\n"
                f"SOURCE NOTES:\n{source_text}\n\n"
                f"INCORRECT ANSWERS:\n{mistakes}"
            ),
        )

    def generate_diagnostic_report(
        self,
        source_text: str,
        incorrect_items: list[dict[str, str]],
        correct_topics: list[str],
        weak_topics: list[str],
        score_percent: int,
    ) -> dict[str, Any]:
        if settings.mock_ai:
            return _mock_diagnostic_report(
                incorrect_items=incorrect_items,
                correct_topics=correct_topics,
                weak_topics=weak_topics,
                score_percent=score_percent,
            )

        if not incorrect_items:
            return {
                "strengths": sorted(set(correct_topics))[:5]
                or ["Strong first-pass understanding of the material"],
                "weak_topics": [],
                "priority_review": [
                    "Regenerate a harder practice quiz to test retention from a different angle.",
                    "Review formulas, definitions, and edge cases once before the exam.",
                ],
                "tutor_explanation": (
                    "You answered every diagnostic question correctly. Keep the momentum by testing "
                    "the same material with harder questions and explaining the key ideas without notes."
                ),
            }

        mistakes = json.dumps(incorrect_items, ensure_ascii=False, indent=2)
        correct = json.dumps(correct_topics, ensure_ascii=False, indent=2)
        weak = json.dumps(weak_topics, ensure_ascii=False, indent=2)
        text = self._create_text_response(
            (
                "You are an exam-prep tutor. Diagnose weak topics from a student's diagnostic test. "
                "Return only valid JSON."
            ),
            (
                "Use the source notes as truth. The student took a diagnostic test. "
                "Create a concise weakness report that helps the student study efficiently before an exam. "
                "Do not restate every question. Focus on concepts, why the mistakes happened, and what to review next. "
                "Return exactly this JSON shape: "
                '{"strengths":["..."],"weak_topics":["..."],"priority_review":["..."],'
                '"tutor_explanation":"..."}.\n\n'
                f"SCORE_PERCENT:\n{score_percent}\n\n"
                f"TOPICS ANSWERED CORRECTLY:\n{correct}\n\n"
                f"WEAK TOPICS FROM MISSED QUESTIONS:\n{weak}\n\n"
                f"SOURCE NOTES:\n{source_text}\n\n"
                f"MISSED QUESTIONS:\n{mistakes}"
            ),
        )
        payload = _parse_json_payload(text)
        return {
            "strengths": _clean_string_list(payload.get("strengths", []), limit=5),
            "weak_topics": _clean_string_list(payload.get("weak_topics", weak_topics), limit=6),
            "priority_review": _clean_string_list(payload.get("priority_review", []), limit=6),
            "tutor_explanation": str(payload.get("tutor_explanation", "")).strip(),
        }

    def generate_targeted_practice(
        self,
        source_text: str,
        weak_topics: list[str],
    ) -> list[dict[str, Any]]:
        if settings.mock_ai:
            return _mock_targeted_practice(source_text, weak_topics)

        topics_text = json.dumps(weak_topics, ensure_ascii=False, indent=2)
        text = self._create_text_response(
            (
                "You create targeted exam-practice drills. "
                "Return only valid JSON and use the source notes as truth."
            ),
            (
                "Create 6 multiple-choice practice questions that specifically train the weak topics below. "
                "If the weak topic list is broad or empty, focus on the most exam-relevant traps in the notes. "
                "Each question must have exactly 4 choices. "
                'The "answer" value must exactly match one of the four choices. '
                "Make the questions more practice-oriented than diagnostic: they should help the student "
                "repair misconceptions and rehearse the method. "
                "Each explanation should explain the correct reasoning, and study_tip should give a concrete "
                "next move the student can use on similar exam questions. "
                "Return exactly this JSON shape: "
                '{"questions":[{"topic":"...","difficulty":"easy|medium|hard",'
                '"question":"...","choices":["...","...","...","..."],'
                '"answer":"...","explanation":"...","study_tip":"..."}]}.\n\n'
                f"WEAK TOPICS:\n{topics_text}\n\n"
                f"NOTES:\n{source_text}"
            ),
        )
        payload = _parse_json_payload(text)
        questions = payload.get("questions", [])
        clean_questions: list[dict[str, Any]] = []
        for item in questions:
            choices = [str(choice).strip() for choice in item.get("choices", []) if str(choice).strip()]
            if len(choices) != 4:
                continue
            topic = str(item.get("topic", "")).strip() or "General"
            difficulty = str(item.get("difficulty", "medium")).strip().lower()
            if difficulty not in {"easy", "medium", "hard"}:
                difficulty = "medium"
            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()
            explanation = str(item.get("explanation", "")).strip()
            study_tip = str(item.get("study_tip", "")).strip()
            if question and answer and explanation and study_tip:
                clean_questions.append(
                    {
                        "topic": topic[:80],
                        "difficulty": difficulty,
                        "question": question,
                        "choices": choices,
                        "answer": answer,
                        "explanation": explanation,
                        "study_tip": study_tip,
                    }
                )
        return clean_questions[:6]

    def answer_question(
        self,
        source_text: str,
        question: str,
        chat_messages: list[ChatMessage],
        summary: str | None = None,
    ) -> str:
        if settings.mock_ai:
            return _mock_chat_answer(source_text, question, summary)

        recent_messages = chat_messages[-6:]
        history = "\n".join(
            f"{message.role.upper()}: {message.content}" for message in recent_messages
        )
        return self._create_text_response(
            (
                "You are a study tutor. Answer using the student's notes as the source of truth. "
                "If the notes do not contain enough information, say that directly and explain what is missing."
            ),
            (
                f"NOTES:\n{source_text}\n\n"
                f"CURRENT SUMMARY:\n{summary or 'No summary generated yet.'}\n\n"
                f"RECENT CHAT:\n{history or 'No previous chat.'}\n\n"
                f"STUDENT QUESTION:\n{question}"
            ),
        )


def _parse_json_payload(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("AI returned JSON but not an object")
    return payload


def _clean_string_list(values: Any, limit: int) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(value).strip() for value in values if str(value).strip()][:limit]


def _mock_topic(source_text: str) -> str:
    first_line = next((line.strip() for line in source_text.splitlines() if line.strip()), "")
    words = first_line.split()
    return " ".join(words[:8]) or "Uploaded material"


def _mock_summary(source_text: str) -> str:
    topic = _mock_topic(source_text)
    return (
        f"# Mock Summary: {topic}\n\n"
        "## Big picture\n"
        "- This is a development-mode summary generated without calling OpenAI.\n"
        "- Use it to test the full product flow, account isolation, rendering, and saved sessions.\n\n"
        "## Key ideas to preserve\n"
        "- Identify the main problem type before memorizing details.\n"
        "- Compress each solution into inputs, goal, method, key steps, and final result.\n"
        "- For exam prep, focus on the reasoning pattern and the common trap.\n\n"
        "## How to study this material\n"
        "1. Read the condensed problem statement.\n"
        "2. Rebuild the solution steps without notes.\n"
        "3. Check formulas, edge cases, and runtime or proof conclusions.\n\n"
        "## Mock note\n"
        "Turn `MOCK_AI=false` and restart the API when you want real OpenAI-generated content."
    )


def _mock_cheat_sheet(source_text: str) -> str:
    topic = _mock_topic(source_text)
    return (
        f"# Mock Cheat Sheet: {topic}\n\n"
        "## Problem pattern\n"
        "- Problem type: recognize the core task, constraints, and expected output.\n"
        "- Minimal setup: define variables, assumptions, and the target result.\n"
        "- Solution template: choose the known method, apply it step by step, then verify edge cases.\n\n"
        "## Reusable exam checklist\n"
        "- State the subproblem or invariant clearly.\n"
        "- Write the base case before the recurrence or transition.\n"
        "- Confirm the evaluation order and final answer location.\n"
        "- Include time and space complexity when the question is algorithmic.\n\n"
        "## Thinking notes\n"
        "- If a question looks long, reduce it to input, goal, method, and final check.\n"
        "- Common pitfall: copying a solution without knowing which condition makes the method valid.\n\n"
        "## Mock note\n"
        "This content is intentionally deterministic so you can test the UI without API cost."
    )


def _mock_flashcards(source_text: str) -> list[dict[str, str]]:
    topic = _mock_topic(source_text)
    return [
        {
            "question": f"What should you identify first when studying {topic}?",
            "answer": "Identify the problem type, inputs, constraints, and the required output.",
        },
        {
            "question": "What makes a study summary exam-ready?",
            "answer": "It preserves the core method, key reasoning steps, final result, and common pitfalls.",
        },
        {
            "question": "Why should formulas be tied to context?",
            "answer": "A formula is useful only when you know when it applies and what each term means.",
        },
        {
            "question": "What should a cheat sheet remove?",
            "answer": "Full prose, repeated examples, and nonessential details that do not help solve exam questions.",
        },
        {
            "question": "What should a diagnostic test reveal?",
            "answer": "It should reveal weak topics and misconceptions before the student spends time reviewing.",
        },
        {
            "question": "How should you review a missed quiz question?",
            "answer": "Explain why the selected answer is wrong, why the correct answer is right, and what concept to review.",
        },
        {
            "question": "What is targeted practice for?",
            "answer": "It drills weak topics until the method becomes repeatable under exam pressure.",
        },
        {
            "question": "How do you know a solution template is reusable?",
            "answer": "It works across similar problems after changing only the inputs and constraints.",
        },
    ]


def _mock_quiz(source_text: str) -> list[dict[str, Any]]:
    topic = _mock_topic(source_text)
    return [
        {
            "question": f"What is the first step when turning {topic} into a study plan?",
            "choices": [
                "Identify the problem type and goal",
                "Memorize every sentence",
                "Skip formulas until the end",
                "Delete all examples",
            ],
            "answer": "Identify the problem type and goal",
            "explanation": "The study flow starts by knowing what kind of task the notes are teaching and what result must be produced.",
        },
        {
            "question": "Which item belongs in a condensed solution summary?",
            "choices": [
                "The core method and key steps",
                "Every copied paragraph",
                "Only the final answer",
                "Unrelated background facts",
            ],
            "answer": "The core method and key steps",
            "explanation": "A useful summary keeps the reasoning path, not just the answer or the full original text.",
        },
        {
            "question": "What should a student do after missing a quiz question?",
            "choices": [
                "Review the concept and explain the correct reasoning",
                "Ignore it if the score is high",
                "Only memorize the answer letter",
                "Regenerate the same answer without reading",
            ],
            "answer": "Review the concept and explain the correct reasoning",
            "explanation": "Missed questions are signals for weak concepts, so the repair step is to rebuild the reasoning.",
        },
        {
            "question": "What makes targeted practice different from a generic quiz?",
            "choices": [
                "It focuses on weak topics found by diagnostic results",
                "It avoids explanations",
                "It uses random topics only",
                "It is unrelated to the uploaded material",
            ],
            "answer": "It focuses on weak topics found by diagnostic results",
            "explanation": "Targeted practice should spend effort where the student is currently weakest.",
        },
        {
            "question": "Why is mock mode useful for developers?",
            "choices": [
                "It tests product flows without OpenAI cost",
                "It permanently replaces real AI",
                "It removes the need for backend tests",
                "It disables saved sessions",
            ],
            "answer": "It tests product flows without OpenAI cost",
            "explanation": "Mock mode returns deterministic study content locally, so UI and API behavior can be tested safely.",
        },
    ]


def _mock_diagnostic(source_text: str) -> list[dict[str, Any]]:
    topic = _mock_topic(source_text)
    return [
        {
            "topic": "Problem framing",
            "difficulty": "easy",
            "question": f"In {topic}, what should you extract before solving?",
            "choices": ["Inputs, goal, constraints", "Only the title", "Only examples", "Only page numbers"],
            "answer": "Inputs, goal, constraints",
            "explanation": "Good exam performance starts by framing what the problem gives and asks for.",
        },
        {
            "topic": "Core method",
            "difficulty": "medium",
            "question": "What should a strong study assistant preserve from a worked solution?",
            "choices": ["Reusable reasoning steps", "Decorative formatting", "All filler text", "Only the score"],
            "answer": "Reusable reasoning steps",
            "explanation": "The value is in compressing the method while keeping enough detail to reproduce it.",
        },
        {
            "topic": "Formula use",
            "difficulty": "medium",
            "question": "When is a formula most useful on a cheat sheet?",
            "choices": [
                "When paired with variables and conditions",
                "When shown without context",
                "When hidden in paragraphs",
                "When unrelated to the topic",
            ],
            "answer": "When paired with variables and conditions",
            "explanation": "Students need to know what the formula means and when it is valid.",
        },
        {
            "topic": "Diagnostic review",
            "difficulty": "easy",
            "question": "What is the main purpose of a diagnostic test?",
            "choices": [
                "Find weak topics before review",
                "Replace all studying",
                "Hide mistakes",
                "Avoid explanations",
            ],
            "answer": "Find weak topics before review",
            "explanation": "The diagnostic directs study time toward the areas with the highest payoff.",
        },
        {
            "topic": "Targeted practice",
            "difficulty": "medium",
            "question": "What should targeted practice questions be based on?",
            "choices": [
                "Weak topics and missed concepts",
                "Random unrelated trivia",
                "The longest paragraph only",
                "The app color theme",
            ],
            "answer": "Weak topics and missed concepts",
            "explanation": "Targeted drills are meant to repair specific gaps revealed by earlier attempts.",
        },
        {
            "topic": "Mistake analysis",
            "difficulty": "hard",
            "question": "Which review note is most useful after a wrong answer?",
            "choices": [
                "Why the selected answer fails and what idea fixes it",
                "Only the correct option",
                "Only a score percentage",
                "A generic encouragement line",
            ],
            "answer": "Why the selected answer fails and what idea fixes it",
            "explanation": "Actionable feedback connects the mistake to a concept and a next step.",
        },
        {
            "topic": "Exam readiness",
            "difficulty": "hard",
            "question": "What is the best sign that a student is exam-ready for a topic?",
            "choices": [
                "They can reproduce the method on a new problem",
                "They recognize the file name",
                "They read the notes once",
                "They generated a long summary",
            ],
            "answer": "They can reproduce the method on a new problem",
            "explanation": "Transfer to a new problem shows the method is understood rather than copied.",
        },
        {
            "topic": "Product testing",
            "difficulty": "easy",
            "question": "What does MOCK_AI=true change?",
            "choices": [
                "AI outputs are generated locally without OpenAI calls",
                "Uploads are disabled",
                "Login is removed",
                "Sessions cannot be saved",
            ],
            "answer": "AI outputs are generated locally without OpenAI calls",
            "explanation": "The backend returns deterministic test content while keeping the same API shapes.",
        },
    ]


def _mock_quiz_review(incorrect_items: list[dict[str, str]]) -> str:
    if not incorrect_items:
        return (
            "Mock review: all submitted answers are correct. For a stronger check, generate a new quiz "
            "or use Diagnostic Test to find weaker topics."
        )
    lines = [
        "Mock tutor review:",
        "These missed questions should be treated as concept signals, not just lost points.",
    ]
    for index, item in enumerate(incorrect_items[:5], start=1):
        lines.append(
            f"{index}. Review the idea behind: {item.get('question', 'this question')}. "
            f"The correct answer is: {item.get('correct_answer', 'the listed answer')}."
        )
    lines.append("Next step: write the method in your own words, then try a targeted drill.")
    return "\n".join(lines)


def _mock_diagnostic_report(
    incorrect_items: list[dict[str, str]],
    correct_topics: list[str],
    weak_topics: list[str],
    score_percent: int,
) -> dict[str, Any]:
    unique_weak = _clean_string_list(weak_topics, 6)
    if not unique_weak and incorrect_items:
        unique_weak = ["Missed concept review"]
    return {
        "strengths": _clean_string_list(correct_topics, 5)
        or ["Basic navigation of the material"],
        "weak_topics": unique_weak,
        "priority_review": [
            "Rebuild each missed solution from inputs to final result.",
            "Write one reusable solution template for each weak topic.",
            "Run targeted practice and check whether the same mistake repeats.",
        ],
        "tutor_explanation": (
            f"Mock diagnostic report: score {score_percent}%. "
            "Use this report to verify the weakness workflow without spending API credits."
        ),
    }


def _mock_targeted_practice(source_text: str, weak_topics: list[str]) -> list[dict[str, Any]]:
    topics = _clean_string_list(weak_topics, 6) or ["Problem framing", "Core method", "Mistake analysis"]
    questions: list[dict[str, Any]] = []
    for index in range(6):
        topic = topics[index % len(topics)]
        questions.append(
            {
                "topic": topic,
                "difficulty": ["easy", "medium", "hard"][index % 3],
                "question": f"Targeted drill {index + 1}: what should you do first for {topic}?",
                "choices": [
                    "State the key idea and required steps",
                    "Guess from the longest answer",
                    "Ignore constraints",
                    "Skip the explanation",
                ],
                "answer": "State the key idea and required steps",
                "explanation": f"For {topic}, the repair move is to make the method explicit before solving.",
                "study_tip": "After answering, explain the same method out loud without reading the notes.",
            }
        )
    return questions


def _mock_chat_answer(source_text: str, question: str, summary: str | None) -> str:
    topic = _mock_topic(source_text)
    return (
        f"Mock tutor answer for {topic}: I would answer your question by first locating the relevant "
        "definition, then connecting it to the worked method in the notes.\n\n"
        f"Your question: {question}\n\n"
        "In real AI mode, this response will be grounded in the uploaded material. In mock mode, it is "
        "only meant to test chat behavior, saved messages, and UI rendering."
    )


ai_service = AIService()
