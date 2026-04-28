# How to Write a System Design Document

> A practical guide for the Eaton Partner App team (and future projects)

---

## Table of Contents

1. [Why System Design Documents Matter](#1-why-system-design-documents-matter)
2. [Before You Start Writing](#2-before-you-start-writing)
3. [The Process: How I Built Our Document](#3-the-process-how-i-built-our-document)
4. [Section-by-Section Breakdown](#4-section-by-section-breakdown)
5. [Design Decision Framework](#5-design-decision-framework)
6. [Common Mistakes to Avoid](#6-common-mistakes-to-avoid)
7. [How to Present Your Design](#7-how-to-present-your-design)

---

## 1. Why System Design Documents Matter

### 1.1 The Real Purpose

A system design document is **not** just documentation—it's a **thinking tool**. Writing forces you to:

- **Discover unknowns early** - You'll find gaps in requirements before writing code
- **Align the team** - Everyone understands what we're building and why
- **Get feedback cheaply** - Changing a document is easier than changing code
- **Create accountability** - Decisions are recorded with rationale
- **Onboard future team members** - They can understand the "why" behind the code

### 1.2 When to Write One

| Scenario | Need a Design Doc? |
|----------|-------------------|
| New feature that touches multiple systems | Yes |
| Simple bug fix | No |
| Adding a new API endpoint | Maybe (brief one) |
| Building a new app from scratch | Absolutely |
| Refactoring existing code | Yes, if it's significant |

For the Eaton Partner App, we're building a **new mobile app that integrates with an existing backend**—this clearly needs a design document.

### 1.3 Industry Context

This approach is used at:
- **Google** - Design docs are required before any significant project
- **Amazon** - 6-page narrative documents (no slides allowed)
- **Stripe** - RFC (Request for Comments) process
- **Meta** - Design review process with templates

The format varies, but the principle is universal: **think before you code**.

---

## 2. Before You Start Writing

### 2.1 Gather Context First

Before writing a single word, I needed to understand:

```
Questions I Asked:
├── What problem are we solving?
├── Who are the users?
├── What already exists?
├── What are our constraints?
└── What decisions have already been made?
```

For the Eaton project, this meant:

| Question | How I Found the Answer |
|----------|------------------------|
| What problem are we solving? | Read CLAUDE.md (project deliverables) |
| Who are the users? | Read TIMELINE.md (mentioned drivers as users) |
| What already exists? | Read prev-team/CLAUDE.md (existing backend, models, APIs) |
| What are our constraints? | Read TIMELINE.md (12-week timeline, 4-person team) |
| What decisions were made? | Read prev-team docs (Django, PostgreSQL, JWT already chosen) |

**Key Insight:** I didn't invent the tech stack—the previous team made those decisions. My job was to document how we'll *integrate* with their work.

### 2.2 Identify Your Audience

Different readers care about different things:

| Reader | What They Care About |
|--------|---------------------|
| **Team Lead** | Does this meet requirements? Is the scope right? |
| **Mobile Dev** | What am I building? What's the architecture? |
| **Backend Dev** | What APIs do I need to create/modify? |
| **QA Dev** | What should I test? What are the edge cases? |
| **Future You** | Why did we make these decisions? |

The document should serve all of them, which is why it has:
- Executive Summary (Team Lead, stakeholders)
- Architecture & API sections (Developers)
- Testing Strategy (QA)
- Alternatives Considered (Future readers)

---

## 3. The Process: How I Built Our Document

### 3.1 The Order I Wrote It (Not the Order It Appears)

```
Actual writing order:
1. Goals & Non-Goals       ← Define scope first
2. User Roles              ← Who are we building for?
3. Functional Requirements ← What features?
4. System Architecture     ← How does it fit together?
5. Data Model              ← What data do we need?
6. API Design              ← How do components talk?
7. Security                ← How do we protect it?
8. Offline/Sync            ← Special mobile concerns
9. Testing                 ← How do we verify it works?
10. Risks                  ← What could go wrong?
11. Alternatives           ← Why this approach?
12. Executive Summary      ← Write LAST (summarizes everything)
```

**Why this order?** You can't write a good summary until you understand the whole system. You can't design APIs until you know the data model. You can't define testing until you know the features.

### 3.2 Research Phase

Before each section, I needed information:

```
Section: System Architecture
├── Read: prev-team/CLAUDE.md
│   └── Found: Django 5.1.6, DRF, PostgreSQL, JWT auth
├── Read: prev-team backend/myapp/models.py
│   └── Found: All existing database models
├── Read: prev-team backend/myapp/urls.py
│   └── Found: All existing API endpoints
└── Synthesized into architecture diagram
```

**The research-then-write pattern:**
1. Read existing code/docs
2. Extract relevant facts
3. Organize into the document structure
4. Add your own decisions/reasoning

### 3.3 Iteration

The document evolved:

```
Version 1: Template with placeholders
    ↓
Version 2: Filled with Eaton-specific content
    ↓
Version 3: Added prev-team details (models, APIs, commands)
    ↓
Version 4: Added diagrams
    ↓
Version 5+: Team feedback and refinements (your job!)
```

---

## 4. Section-by-Section Breakdown

### 4.1 Executive Summary

**Purpose:** Anyone should understand the project in 30 seconds.

**How to write it:**
1. Write it LAST
2. One paragraph, 3-5 sentences
3. Answer: What? Why? For whom? How?

**Formula:**
```
[Company/Product] needs [solution] because [problem].
This document describes [approach] that will [key benefits].
It integrates with [existing systems] using [technologies].
```

### 4.2 Goals and Non-Goals

**Purpose:** Prevent scope creep. Align expectations.

**Why Non-Goals are critical:**

Without non-goals, conversations happen like this:
> "Hey, while you're building the mobile app, could you also add real-time GPS tracking?"

With non-goals documented:
> "That's explicitly listed as NG2 in our design doc. We can revisit for Phase 2."

**How I chose our non-goals:**
- Features that sound reasonable but add complexity (GPS tracking, chat)
- Features for different user types (customer-facing features)
- Features that have existing solutions (route optimization via Google Maps)

### 4.3 User Roles and Personas

**Purpose:** Keep the user in focus. Drive feature decisions.

**How I approached it:**

1. **Identified the primary user:** Drivers (from CLAUDE.md deliverables)
2. **Characterized them realistically:**
   - CDL-licensed (professional, trained)
   - Varying tech comfort (can't assume tech-savvy)
   - Using phone while working (needs to be simple, one-handed)
   - Variable connectivity (offline support matters)

3. **Wrote user stories in their voice:**
   - "As a driver, I want to..." (not "The system shall...")
   - Each story maps to a feature requirement

### 4.4 Functional Requirements

**Purpose:** Unambiguous list of what the app must do.

**Naming convention:** `FR-[CATEGORY]-[NUMBER]`
- FR = Functional Requirement
- Category groups related features (AUTH, JOB, NOTIF, etc.)
- Number for easy reference

**Priority levels:**
| Priority | Meaning | Example |
|----------|---------|---------|
| P0 | Must have for launch | Login, view jobs |
| P1 | Should have, important | Push notifications |
| P2 | Nice to have | Notification history |

**How I prioritized:**
- P0: Without this, the app is useless
- P1: Users expect this, but can workaround
- P2: Would delight users, but not blocking

### 4.5 Non-Functional Requirements

**Purpose:** Define quality attributes—how well the system performs.

**Why specific numbers matter:**

Bad: "The app should be fast"
Good: "App launch to usable < 3 seconds on mid-range device"

Specific numbers:
- Can be tested objectively
- Set clear expectations
- Become acceptance criteria

**How I chose our targets:**
- **3 second app launch:** Industry standard for mobile apps
- **< 500ms API response:** Good user experience threshold
- **99.5% uptime:** Realistic for a small-team project
- **iOS 14+, Android 8+:** Balances device coverage vs. development complexity

### 4.6 System Architecture

**Purpose:** Show how all the pieces fit together.

**The layered approach:**

```
Client Layer    → What users interact with
      ↓
API Layer       → How clients talk to backend
      ↓
Data Layer      → Where data lives
```

**Why I made these architecture decisions:**

| Decision | Reasoning |
|----------|-----------|
| Keep existing Django backend | Already built, tested, deployed. Don't rebuild. |
| Add `/api/mobile/` endpoints | Separates mobile-specific logic from web endpoints |
| New Issue & Device models | Needed for mobile features, doesn't affect web app |
| Push via FCM/APNs | Industry standard, Expo simplifies integration |

**The key insight:** Our job is to **extend**, not replace. The architecture shows what exists (gray) vs. what we build (green).

### 4.7 API Design

**Purpose:** Contract between mobile and backend developers.

**How I documented existing vs. new:**

1. **Audited existing endpoints** (from prev-team urls.py)
2. **Evaluated each for mobile use:**
   - "Mobile Ready?" - Can we use as-is?
   - "Mobile Changes Needed?" - What modifications?
3. **Designed new endpoints** for mobile-only features

**API specification format:**
```
METHOD /path/
Authorization: [required auth]

Request:
{...}

Response [status]:
{...}
```

This format is clear enough that:
- Backend Dev can implement it
- Mobile Dev can consume it
- QA Dev can test it

### 4.8 Data Model

**Purpose:** Define the entities and relationships.

**How I approached it:**

1. **Read existing models.py** - Don't reinvent what exists
2. **Identified what mobile needs:**
   - Driver (existing) ✓
   - Job (existing) ✓
   - JobDriverAssignment (existing) ✓
   - Issue (NEW - for problem reporting)
   - Device (NEW - for push notifications)

3. **Created ER diagram** showing relationships

**Why I separated "Existing" vs "New":**
- Backend Dev knows what to create
- Team knows what's already done
- Reduces scope confusion

### 4.9 Security Design

**Purpose:** Protect user data and prevent unauthorized access.

**Why sequence diagrams for auth:**
- Shows the flow over time
- Identifies where tokens are used
- Makes the process auditable

**Security decisions explained:**

| Decision | Why |
|----------|-----|
| SecureStore for tokens | AsyncStorage is not encrypted. Tokens are sensitive. |
| Short-lived access tokens (15 min) | Limits damage if token is stolen |
| Refresh token rotation | Prevents replay attacks |
| Role-based access | Drivers shouldn't see all jobs, just their own |

### 4.10 Offline and Sync Strategy

**Purpose:** Mobile apps must work with bad connectivity.

**Why this matters for trucking:**
- Drivers go through rural areas
- They go through tunnels
- Cell service is inconsistent

**The sync approach:**

1. **Optimistic UI** - Show changes immediately
2. **Queue offline actions** - Store with timestamps
3. **Sync when online** - Process queue in order
4. **Handle conflicts** - What if data changed on server?

**Conflict resolution philosophy:**
- Server state wins (simpler)
- But always inform the user
- Never silently lose data

### 4.11 Testing Strategy

**Purpose:** Ensure quality. Guide QA efforts.

**Test pyramid for mobile:**

```
        /\
       /  \  E2E Tests (few, slow, expensive)
      /----\
     /      \ Integration Tests (more, medium)
    /--------\
   /          \ Unit Tests (many, fast, cheap)
  /____________\
```

**Critical scenarios = P0 tests**
These are the tests that MUST pass before any release.

### 4.12 Risks and Mitigations

**Purpose:** Show mature engineering thinking. Prepare for problems.

**How I identified risks:**

1. **Technical risks:** What could be hard to build?
2. **Integration risks:** What could fail when systems connect?
3. **Process risks:** What could delay the project?
4. **External risks:** What dependencies do we not control?

**The mitigation pattern:**
- Identify the risk
- Assess likelihood and impact
- Define a specific action to reduce it

### 4.13 Alternatives Considered

**Purpose:** Show you evaluated options. Explain why you chose your approach.

**Why this section is crucial:**

Future reader: "Why didn't they just use Flutter?"
Document: "See section 13.1 - we evaluated Flutter but chose React Native because the team has React experience and the timeline is tight."

**How I structured comparisons:**

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Option A | ... | ... | Selected/Rejected + why |
| Option B | ... | ... | Selected/Rejected + why |

### 4.14 Open Questions

**Purpose:** Be honest about unknowns. Drive decision-making.

**Every open question needs:**
- **Owner:** Who will find the answer?
- **Due date:** When do we need it by?
- **Resolution:** (Filled in once decided)

**Why this matters:**
- Prevents blocked work
- Creates accountability
- Tracks decisions over time

---

## 5. Design Decision Framework

### 5.1 How to Make Decisions

When choosing between options, I use this framework:

```
1. Define the criteria that matter
2. List the options
3. Evaluate each option against criteria
4. Choose and document why
```

**Example: Choosing a mobile framework**

Criteria:
- Cross-platform (iOS + Android)
- Team experience
- Time to market
- App store deployment

Evaluation:
| Criteria | React Native | Flutter | Native |
|----------|--------------|---------|--------|
| Cross-platform | ✓ | ✓ | ✗ |
| Team experience | ✓ (React) | ✗ (Dart) | ✗ |
| Time to market | Fast | Fast | Slow (2x work) |
| App store | Expo simplifies | Standard | Standard |

Decision: React Native (Expo)

### 5.2 When to Defer Decisions

Not everything needs to be decided upfront. Defer when:
- You need more information
- The decision doesn't block progress
- You want team input

In our document, `[DECISION NEEDED]` marks deferred decisions:
- State management: Zustand vs Redux
- Local storage: AsyncStorage vs SQLite

These can be decided in Week 2 after the team evaluates options.

### 5.3 Documenting Trade-offs

Every decision has trade-offs. Be explicit:

```
Decision: Use Expo (managed workflow)
Trade-off: Easier builds, but some native modules not available
Why acceptable: We don't need those modules for our features
```

---

## 6. Common Mistakes to Avoid

### 6.1 Writing Too Much

**Problem:** 50-page documents that no one reads.

**Solution:**
- Keep sections concise
- Use tables and diagrams
- Link to details instead of embedding them

### 6.2 Writing Too Little

**Problem:** Vague statements that don't guide implementation.

**Bad:** "The app will have offline support."
**Good:** "Job data is cached locally using AsyncStorage. Status updates are queued when offline and synced (oldest first) when connectivity returns. Conflicts are resolved by showing the user the server state and asking them to re-submit."

### 6.3 Not Getting Feedback

**Problem:** Writing in isolation, then being surprised by objections.

**Solution:**
- Share early drafts
- Ask specific questions
- Incorporate feedback visibly

### 6.4 Treating It as Final

**Problem:** Never updating the document as things change.

**Solution:**
- Version the document
- Update when decisions change
- Mark resolved open questions

### 6.5 Copying Without Understanding

**Problem:** Using a template without thinking about why each section exists.

**Solution:**
- Delete sections that don't apply
- Add sections that your project needs
- Customize examples to your context

---

## 7. How to Present Your Design

### 7.1 The Design Review Meeting

When presenting to your team:

1. **Start with context** (2 min)
   - What problem are we solving?
   - Who is affected?

2. **Walk through the architecture** (10 min)
   - Show the diagram
   - Explain each component
   - Highlight what's new vs. existing

3. **Dive into critical sections** (15 min)
   - API contracts
   - Data model
   - Security

4. **Discuss risks and open questions** (10 min)
   - Get input on mitigations
   - Assign owners to questions

5. **Gather feedback** (10 min)
   - What's unclear?
   - What's missing?
   - What concerns do you have?

### 7.2 Handling Pushback

When someone disagrees with your design:

1. **Listen fully** - Understand their concern
2. **Ask clarifying questions** - "Can you give an example?"
3. **Evaluate objectively** - Is their concern valid?
4. **Either:**
   - Update the design (and document why)
   - Explain why you're keeping your approach (and document the alternative in section 13)

### 7.3 Getting Sign-off

Before starting implementation:
- [ ] All team members have read the document
- [ ] Major concerns have been addressed
- [ ] Open questions have owners and due dates
- [ ] Document status is changed to "Approved"

---

## Summary: The System Design Mindset

Writing a system design document is about:

1. **Thinking rigorously** before coding
2. **Communicating clearly** to your team
3. **Making decisions** and explaining why
4. **Anticipating problems** and planning for them
5. **Creating a reference** for the future

The document we created for the Eaton Partner App isn't perfect—it's a starting point. Your job is to:
- Fill in the `[YOUR CONTENT HERE]` sections
- Resolve the `[DECISION NEEDED]` items
- Answer the open questions
- Update it as you learn more

**The best system design document is one that your team actually uses.**

---

## Quick Reference: Section Checklist

| Section | Key Question It Answers |
|---------|------------------------|
| Executive Summary | What is this project about? |
| Goals & Non-Goals | What are we building (and not building)? |
| User Roles | Who are we building for? |
| Functional Requirements | What features does it have? |
| Non-Functional Requirements | How well does it need to perform? |
| System Architecture | How do all the pieces fit together? |
| API Design | How do components communicate? |
| Data Model | What data do we store and how? |
| Security | How do we protect it? |
| Offline/Sync | How does it work without internet? |
| Testing | How do we know it works? |
| Risks | What could go wrong? |
| Alternatives | Why this approach over others? |
| Open Questions | What don't we know yet? |

---

*This guide was created for the Eaton Partner App project. Adapt it for your future projects.*
