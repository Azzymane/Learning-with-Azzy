# Business case: Desk + Luvs You ♡

Desk + Luvs You is a study companion that helps students organize schoolwork and
think through what they are learning. Its name and friendly pink-and-heart
visual identity are intended to make studying feel more approachable. This
business case describes the idea and its assumptions; pricing, integrations,
and AI safeguards would need to be tested before launch.

## 1. The idea

- **Customer:** My primary customers are secondary-school and college students
  who have assignments, course materials, and deadlines to keep track of.
  Students who want help studying without having an AI complete their work are
  an especially good fit. A later customer group could be schools or families
  that want a structured study and reminder tool.
- **Problem:** Students often keep syllabi, class schedules, assignment
  instructions, and study notes in different places. It is easy to miss a
  deadline or feel unsure how to begin studying. Existing calendars can track
  dates, and general-purpose AI tools can respond to almost any prompt, but
  these do not necessarily combine a study workspace, reminders, and
  question-based practice grounded in a student's own materials.
- **Solution:** Desk + Luvs You brings these tasks into one workspace:
  - A blank, whiteboard-style home page with a brainstorming bubble for
    jotting down thoughts and study prompts.
  - Optional screen sharing, where supported, or document uploads for school
    work, notes, syllabi, schedules, and calendars.
  - AI-generated study questions, flashcards, and practice quizzes based on
    the materials a student provides. For example, when a document says
    “X is...” or “X refers to...,” the app can turn the concept into a
    “What is X?” question and use the provided definition as the study
    material. The AI is intended to ask questions and support recall, not
    complete assignments or answer unrelated questions.
  - A calendar and checklist that turn syllabus dates and uploaded events into
    assignment and event reminders. The product should support the 2026–2027
    school year, while letting users review extracted dates and choose their
    own reminder settings.
  - A menu for the calendar, checklist, and study-time summaries.
- **Revenue:** My initial pricing hypothesis is to charge $0.50 for each
  AI-powered request, such as generating a set of study cards or a quiz. Basic
  workspace, calendar, and checklist features could be free, with optional
  paid plans considered later. I would test whether students understand and
  accept per-use pricing, and compare the price with actual AI, storage, and
  payment-processing costs before relying on it. “Fifty cents per request” is
  a proposed customer price, not an assumption that each API call costs that
  amount.

## 2. Where IT creates value

The app changes how students organize and prepare for schoolwork. Document
parsing can turn dates in syllabi into a draft calendar, and AI can transform
definitions in uploaded study materials into reusable questions and cards.
That reduces repetitive setup and makes the materials more useful for
practice. A student can move from seeing a deadline, to planning study time,
to testing their recall in the same product.

Cloud services make it possible to provide the app through a website without
students installing specialized software. They also allow the service to scale
as usage grows. The central differentiation is the combination of a
student-controlled whiteboard, reminders, and question-based study support
rather than an AI that simply supplies finished answers.

The product can use data to provide value when it extracts a student's own
dates and course concepts. This data is sensitive, so it should be used only
for the requested features, protected appropriately, and not treated as an
asset to sell. If users can export their calendar and materials, that helps
build trust; it may also reduce switching costs, so the business should earn
retention through useful features rather than trapping student data.

## 3. Network effects

At launch, Desk + Luvs You is mainly a **one-sided market**: students use the
same product for their own school materials. More students using it does not
automatically make an individual student's calendar or flashcards better, so
the initial network effects are weak.

There could be optional value from sharing teacher-approved study sets or
class resources with classmates, but this would require clear permissions and
should not expose private assignments or student files. I would not make
sharing or a large user network necessary for the product to work.

To solve the empty-network problem, I would launch with useful individual
features: a blank study workspace, document-based practice questions, a
checklist, and reminders. Students could try these without waiting for other
users to join. The prototype's workspace, uploads, AI study tools, and
calendar/checklist show this standalone value.

## 4. Can it be copied? (the moat question)

The website and its code are not a lasting competitive advantage; another
team could reproduce the basic features. The more promising advantage is
building a trusted study experience around student control, clear AI limits,
and reliable handling of school materials.

- **Valuable:** Students may save time organizing materials and get more
  structured practice.
- **Rare:** The combination of a friendly whiteboard, syllabus-based
  reminders, and AI that creates questions instead of doing schoolwork could
  be distinctive if students find it genuinely helpful.
- **Hard to imitate:** The individual features are not especially hard to
  copy. A competitor would need to match the product's usability, reliable
  date extraction, quality of study questions, and trust with students and
  schools. This is a goal to validate, not a proven moat.
- **Organized to capture value:** The business would need clear privacy and
  AI-use rules, dependable cloud operations, accessible design, and a pricing
  model that covers operating costs.

Over time, a recognizable brand and consistently useful study workflows could
strengthen retention. With permission, product feedback could help improve
question quality and date extraction, but private student documents should not
be reused for model training by default. I would avoid claiming that a large
collection of student data is a competitive advantage.

## 5. Cloud and operations

I would run Desk + Luvs You as a web app using cloud services:

- **SaaS:** An external AI API could generate study questions from material a
  student has chosen to submit. A calendar or notification provider could
  support reminders if needed.
- **PaaS:** A managed application host, database, and file-storage service
  could run the website, store user settings and uploaded files, and support
  account access.
- **IaaS:** I might not need to manage virtual machines at the beginning if
  managed hosting meets the product's needs.

Cloud services make the app easier to launch and scale, but create dependency
on providers, their prices, service availability, and data-handling practices.
The product should minimize stored data, protect accounts and files, explain
which providers process uploads, and offer deletion and export controls.
Calendar dates extracted from a syllabus should be shown for user review
before reminders are activated.

The $0.50-per-AI-request idea must be evaluated against actual API usage:
different requests can cost different amounts, and storage, hosting, support,
and payment processing also cost money. I would measure costs and test pricing
with students before launch rather than promise that every request has the
same cost.

## 6. Risks and ethics

- **Academic integrity and school AI policies:** The product should not do
  assignments for students. If a school or document indicates that AI use is
  restricted, the app should not send that material to an AI service. A
  detection mechanism can make mistakes, so the app should clearly explain
  its limits, let users report or correct a flag, and default to not processing
  flagged material with AI. Non-AI tools such as the checklist can remain
  available where appropriate.
- **Answers outside the course material:** AI can produce incorrect or
  unrelated content. It should generate questions from user-provided material,
  avoid answering general outside questions, and show which source material
  informed a question. Students should be able to review and edit generated
  cards.
- **Privacy and screen sharing:** Schoolwork, schedules, and screen contents
  can contain sensitive information. Screen sharing must be optional and
  user-initiated, with a clear indication when it is active and an easy way to
  stop it. Uploads should be limited to what is needed, access-controlled, and
  deletable by the user. The app should not capture or analyze other screen
  content in the background.
- **Calendar mistakes:** A syllabus parser may misread a date, time, or
  assignment. Extracted events should be presented for confirmation, use the
  user's chosen time zone, and be editable. The app should not imply that
  reminders replace checking official course updates.
- **Reliability, accessibility, and cost:** AI and cloud services can be
  unavailable, change price, or process requests inconsistently. The app
  should communicate failures clearly, offer core non-AI features when
  possible, and use accessible layouts and notification settings. Usage-based
  charges should be visible before a student makes a paid request.
