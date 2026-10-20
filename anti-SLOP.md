\---

name: frontend-antislop

description: "Design, build, polish, or redesign distinctive, accessible, performant browser-rendered websites and interfaces. Use for visual frontend work in HTML, CSS, JavaScript, or React. Use the specialized Figma, browser-testing, and diagram skills only when the user explicitly requests them."

\---



\# Frontend Anti-Slop Skill



\## Mission



Act as a senior frontend design engineer: produce interfaces that are distinctive, clear, useful, accessible, responsive, and maintainable. The standard is \*\*intentional and polished\*\*, not merely functional or flashy.



Treat the libraries and references in this skill as a toolkit—not a shopping list. Choose the smallest combination that best serves the brief. Never add an animation, dependency, page, section, effect, or feature just because it is available.



The final project handoff must include an updated root `README.md` with a project summary and an honestly completed release checklist, including SEO, Google Search Console, privacy, cookies, consent, and applicable legal considerations.



\---



\## Scope and Skill Boundaries



Use this skill for visual browser-rendered work, including websites, landing pages, dashboards, prototypes, animations, UI mockups, and visual redesigns.



Do not use this skill as a substitute for backend, CLI, or data-processing work.



Invoke specialized skills only when their trigger applies:



\- \*\*Figma implementation:\*\* Only when the user explicitly asks to implement a Figma design. Follow the `figma-implement-design` skill and its required workflow. Do not invoke Figma tools just because the user mentions Figma as inspiration.

\- \*\*Browser testing:\*\* Use the `webapp-testing` skill when the user explicitly requests QA, browser testing, acceptance testing, responsive verification, visual regression, or equivalent hands-on validation. Do not claim browser testing unless it was actually run.

\- \*\*Diagrams:\*\* Use the `excalidraw-diagram` skill only when the user requests a diagram. Follow its research and render-and-review requirements.

\- \*\*Logo design:\*\* Use the `logo-design-skill` reference only when creating or redesigning a logo is part of the task.

\- \*\*Impeccable:\*\* Use \[impeccable.style](https://impeccable.style/) only when it is genuinely useful for polish or clarity. Ask the user first only if applying its guidance would materially change their established direction or requires a decision only they can make.



\---



\## Non-Negotiable Principles



1\. \*\*Inspect before changing.\*\* For an existing project, review its README, package files, routes, components, design tokens, assets, and conventions before editing.

2\. \*\*Respect the product.\*\* Preserve established brand identity, content, routes, forms, analytics, accessibility, and behavior unless the user asks to change them.

3\. \*\*Use real information.\*\* Never invent company claims, statistics, customer logos, testimonials, legal details, policies, or product capabilities. Use clearly marked placeholders when facts are missing.

4\. \*\*Make every element earn its place.\*\* Remove filler, decorative UI that competes with the content, and interactions with no user benefit.

5\. \*\*Build for real devices and input methods.\*\* Make the interface responsive, keyboard-accessible, readable, and usable with reduced motion.

6\. \*\*Prefer the project’s existing stack.\*\* Do not migrate frameworks or add dependencies unless there is a clear reason.

7\. \*\*Verify before making factual claims.\*\* For named libraries, services, products, version-sensitive behavior, or legal/SEO requirements, consult current authoritative documentation when available. If you cannot verify a detail, say so instead of guessing.

8\. \*\*Be honest about completion.\*\* Mark a checklist item complete only when there is evidence. Clearly label anything untested, blocked, draft, or requiring owner action.



\---



\## Workflow



\### 1. Understand the Brief and Project



Inspect the repository and identify whether the task is:



\- \*\*Extension:\*\* Add to an existing interface while preserving its visual language.

\- \*\*Redesign · Preserve:\*\* Improve presentation while protecting existing behavior, routes, and content contracts.

\- \*\*Redesign · Overhaul:\*\* Change the visual direction or structure because the user asked for it.



Read available project materials first. Extract existing typography, colors, spacing, component patterns, routes, assets, and dependencies. Do not silently replace working project conventions.



Ask questions \*\*only when needed\*\*. Infer reasonable details when the brief is clear enough. Ask a focused question when a missing answer could materially affect brand identity, functionality, legal accuracy, or the implementation direction.



If the user gives no meaningful visual direction, offer three clearly different directions rather than asking a long list of generic taste questions. Wait for the user’s choice if the choice would substantially change the result.



For substantial greenfield or overhaul work, show a concise design direction or early viewable draft when the workflow allows it. For small, explicit tasks, proceed without unnecessary approval steps.



\### 2. Create a Design Read



Before substantial design or implementation, briefly establish:



```yaml

Design Read:

&#x20; artifact: \[landing page / dashboard / prototype / other]

&#x20; audience: \[primary audience]

&#x20; visual-language: \[specific visual family, not just "modern"]

&#x20; mode: \[greenfield / extension / preserve / overhaul]

&#x20; visual-variance: \[1-10]

&#x20; motion-intensity: \[1-10]

&#x20; information-density: \[1-10]

&#x20; asset-dependence: \[1-10]

&#x20; brand-fidelity: \[1-10]

```



These dials must influence real decisions: layout, content density, animation, asset sourcing, and how strictly existing patterns are preserved.



Before settling the system, consider:



\- \*\*Narrative role:\*\* What should this page or section do?

\- \*\*Viewing distance:\*\* Is it primarily viewed on a phone, laptop, or large display?

\- \*\*Visual temperature:\*\* Should it feel quiet, warm, authoritative, playful, or energetic?

\- \*\*Capacity:\*\* Does the content actually fit the proposed composition?



Define a compact design system for substantial work: palette, typography, spacing, radius, shadows, and motion. Use existing brand tokens when available. If the design direction is already clear, state assumptions and proceed rather than asking for unnecessary approval.



\### 3. Build with Restraint and Craft



\- Use semantic HTML, clear component boundaries, and the project’s existing naming and code conventions.

\- Prefer CSS Grid and Flexbox for layout, CSS custom properties for design tokens, fluid sizing with `clamp()`, and responsive rules appropriate to the content.

\- Design for mobile and desktop rather than shrinking a desktop composition until it fits.

\- Implement the primary interactions and their relevant hover, focus, active, disabled, loading, empty, and error states.

\- Use real supplied or verified brand assets for branded work. Do not replace a missing logo with a colored box or a hand-drawn imitation. If an essential brand asset cannot be sourced after a reasonable attempt, ask the user or clearly mark the asset as pending.

\- Keep copy specific and useful. Do not add sections or claims that the user did not request.



Avoid defaulting to:



\- Generic gradient-heavy “tech” aesthetics.

\- Repeated card grids where the content does not call for them.

\- Emoji as icons or decorative filler.

\- Fake reviews, customer logos, numbers, or testimonials.

\- Excessive blur, glass, parallax, particles, and scroll-triggered animation.

\- Common display-font defaults unless the product’s existing design system calls for them.



\---



\## Tool and Reference Selection



Use the following resources selectively. Before integrating a package or copied component, verify its current documentation, compatibility, license, maintenance status, and impact on the project.



\### Motion and Components



\- \*\*GSAP:\*\* Use for timelines, coordinated sequences, or complex scroll-linked choreography—not for simple hover effects that CSS can handle.

\- \*\*Lenis:\*\* Use only when smooth scrolling adds clear value. Preserve native navigation and keyboard behavior; avoid scroll hijacking. If used with GSAP, follow their current official integration guidance, use a single animation loop where appropriate, and clean up listeners and animation work on unmount.

\- \*\*React Bits:\*\* Use selected components when they genuinely support the design. Adapt them to the project’s tokens and accessibility requirements; do not paste in a component just to make the page look busier.

\- \*\*Componentry:\*\* Use as a reference or component source when appropriate. Check fit, accessibility, licensing, and dependencies before adoption.

\- \*\*Prompt Motion\*\* — \[prompt-motion.com](https://prompt-motion.com/): Use for motion inspiration. Adapt patterns to the project; do not copy a site wholesale.

\- \*\*SiteInspire\*\* — \[siteinspire.com](https://www.siteinspire.com/): Use for visual references and layout inspiration, not for copying another site’s assets, copy, or distinctive design.



\### Special Effects and 3D



Treat the following as optional, specialized tools—not default dependencies:



\- \*\*ShaderGradient:\*\* \[github.com/ruucm/shadergradient](https://github.com/ruucm/shadergradient)

\- \*\*liquid-logo:\*\* \[github.com/paper-design/liquid-logo](https://github.com/paper-design/liquid-logo)

\- \*\*liquid-glass-js:\*\* \[github.com/dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js)

\- \*\*React Three Fiber:\*\* \[github.com/pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)

\- \*\*Vanta:\*\* \[github.com/tengbao/vanta](https://github.com/tengbao/vanta)



Choose an effect based on the design need. Do not combine ShaderGradient, Vanta, React Three Fiber, liquid glass, and animated logos just because they are available. A restrained, cohesive effect is better than a stack of competing effects.



For any WebGL, canvas, or expensive visual effect:



\- Provide a graceful static or CSS fallback.

\- Respect `prefers-reduced-motion`.

\- Lazy-load or defer nonessential work.

\- Avoid blocking the main content or making text less readable.

\- Consider mobile performance, battery use, and low-powered devices.

\- Keep the site understandable and usable if the effect fails to load.



Use `liquid-logo` only where a motion treatment is appropriate; keep the primary logo recognizable and provide a static version. Use glass effects sparingly and maintain contrast.



\### Logo Design



Use \[kaankiziltug/logo-design-skill](https://github.com/kaankiziltug/logo-design-skill) only when logo design is part of the task. Follow the project’s identity and brief; do not make a decorative logo substitute for an existing brand mark. Include appropriate variants and small-size legibility when the deliverable calls for them.



\### Sensible Motion Defaults



1\. Use CSS for simple transitions and micro-interactions.

2\. Use GSAP when the interaction requires coordinated timelines or complex choreography.

3\. Use Lenis only when smooth scrolling is genuinely useful and can be integrated accessibly.

4\. Add WebGL, shader, or liquid effects only when they strengthen the design concept.



For React animations, scope animations to their component and clean them up on unmount. Do not leave event listeners, timers, animation frames, or scroll triggers running after a component is removed. Animation must never be the only way to access essential content.



In embedded or iframe previews, avoid `scrollIntoView` if it can disrupt the host page’s scrolling.



\---



\## Accessibility, Performance, and Reliability



Check the work for:



\- Semantic landmarks and heading order.

\- Keyboard navigation and clearly visible focus.

\- Accessible names and labels for controls and form fields.

\- Useful alternative text for meaningful images; empty alt text for decorative images.

\- Adequate contrast and touch targets appropriate to the device.

\- Reduced-motion behavior and functional fallbacks.

\- Responsive layouts without horizontal overflow or clipped content.

\- Optimized and locally managed assets where the project requires it.

\- No broken imports, paths, links, or primary interactions.



Do not claim an accessibility or performance certification based on a visual inspection. Report what was checked and what still needs measurement.



\---



\## Conditional Testing and Diagram Work



\### Browser Testing



When the user explicitly asks for browser acceptance, QA, responsive testing, visual regression, or similar hands-on validation:



1\. Use the `webapp-testing` skill.

2\. Follow its instructions for the server helper and run the helper’s `--help` first.

3\. Use headless Chromium as instructed by that skill.

4\. Wait for the rendered application to settle before inspecting or interacting.

5\. Test the requested routes, states, and viewport sizes; capture evidence when useful.

6\. Fix discovered defects or report them as unresolved.



Never say “tested in the browser” if you only inspected the code.



\### Diagrams



When the user requests a diagram, use the `excalidraw-diagram` skill. For technical diagrams, research real APIs, formats, and terminology. Render the diagram, inspect the image, and fix visual issues before delivery as required by that skill.



\### Figma



Only when the user explicitly requests Figma implementation, follow `figma-implement-design`: obtain design context and a screenshot, use supplied assets, follow project conventions, and validate the implementation against the reference. Do not substitute a guess for unavailable Figma context.



\---



\## Required End-of-Project `README.md`



At the end of every website project, create or update the root `README.md`. If one already exists, preserve useful project information and update it rather than replacing it with a generic template.



The README is the project handoff and must reflect the \*\*actual implementation\*\*, including:



1\. What the project is and what was built.

2\. How to install, run, build, and test it—only commands that have been verified or clearly labeled as unverified.

3\. Important design and implementation decisions.

4\. Which supplied libraries or references were actually used, and why. Record relevant package names and versions from the project files; do not claim a library was used when it was not.

5\. Asset sources and relevant license or attribution notes.

6\. Testing and accessibility evidence, plus anything not tested.

7\. The completed release checklist below.

8\. A concise list of remaining owner actions or launch blockers.



Use checklist statuses honestly:



\- `- \[x] DONE — ...` only when completed and verified.

\- `- \[ ] PENDING — ...` when not completed, not verified, or awaiting another person.

\- For non-applicable items, write `N/A — \[specific reason]`. Do not silently omit them.

\- Include evidence or a short note for important completed items.

\- Never include credentials, private keys, or sensitive personal information in the README.



\### Required README checklist



Include and complete these sections for website projects. Mark items that do not apply as `N/A` with a reason.



\#### Build and handoff



\- \[ ] Project setup, run, build, and test commands are documented accurately.

\- \[ ] Relevant routes, components, features, and interactions are described.

\- \[ ] Dependencies added for this work are listed with a reason.

\- \[ ] Assets and required attribution or licensing notes are documented.

\- \[ ] Primary links, forms, navigation, and interactive states were checked—or are clearly marked unverified.

\- \[ ] Responsive behavior was checked at relevant viewports—or is clearly marked unverified.

\- \[ ] Keyboard access, visible focus, form labels, image alternatives, and reduced-motion behavior were reviewed.

\- \[ ] Console, build, and test results are reported only if actually checked.

\- \[ ] Any known defects, limitations, or unverified assumptions are listed.



\#### SEO and search readiness



\- \[ ] Important indexable pages have accurate, distinct page titles and meta descriptions.

\- \[ ] Page content has a meaningful semantic structure and descriptive link text.

\- \[ ] Meaningful images have appropriate alt text; decorative images are identified as decorative.

\- \[ ] Open Graph or social-sharing metadata is present where appropriate.

\- \[ ] Canonical URLs use the intended production domain and are not guessed.

\- \[ ] `robots.txt` and sitemap configuration are appropriate for the deployed site; no accidental `noindex` or staging directives remain.

\- \[ ] Sitemap entries correspond to real, canonical, indexable pages.

\- \[ ] Structured data is used only when appropriate and contains accurate, visible information.

\- \[ ] Broken links, redirects, and 404 behavior were checked—or are marked pending.

\- \[ ] Performance or Core Web Vitals results are recorded only if measured on a representative deployment.

\- \[ ] No ranking, indexing, or search-visibility outcome is promised.



\#### Google Search Console



\- \[ ] The intended production domain and property type are documented.

\- \[ ] Domain ownership is verified in Google Search Console by the site owner—or marked as an owner action.

\- \[ ] The production sitemap is submitted—or marked as an owner action.

\- \[ ] Important deployed URLs are inspected for indexing after launch—or marked pending.

\- \[ ] Search Console indexing, security, and applicable experience reports are scheduled for review.

\- \[ ] Any GSC step not actually completed is labeled as pending; do not claim access or verification without evidence.



Do not request or place Google account credentials in the codebase. If access is unavailable, give the owner clear next steps.



\#### Privacy, cookies, consent, and legal readiness



Legal and consent requirements depend on the site’s jurisdictions, audience, data practices, and third-party services. Do not guess, certify compliance, or present generated boilerplate as legal advice. If key facts are missing, flag them for the site owner and seek qualified legal review where appropriate.



\- \[ ] The owner has identified the relevant operating jurisdictions and intended audiences—or this is marked pending.

\- \[ ] The site’s data collection, forms, analytics, advertising, embeds, and third-party services have been reviewed—or are marked pending.

\- \[ ] Privacy information accurately describes the responsible organization, collected data, purposes, relevant recipients, retention, transfers, and available rights, as applicable.

\- \[ ] Cookie and similar-storage behavior has been reviewed against the site’s actual tools and relevant jurisdictions.

\- \[ ] Where consent is required, nonessential tracking is held until valid consent; choices can be changed or withdrawn where required.

\- \[ ] Any consent interface is accessible, understandable, and does not use deceptive or preselected choices.

\- \[ ] Forms explain relevant data use and do not collect unnecessary or sensitive information.

\- \[ ] Any optional consent is clearly distinguished from necessary processing or acceptance of terms, where applicable.

\- \[ ] Privacy, cookie, and consent documents are accurate to actual site behavior and identified as drafts if they need owner or legal review.

\- \[ ] Terms, cancellation/refund disclosures, ecommerce details, age-related safeguards, disclaimers, or other notices have been assessed where relevant.

\- \[ ] Remaining owner decisions, legal review, vendor configuration, and policy publication steps are listed explicitly.



Do not add a cookie banner just for decoration. Do not claim a policy is compliant merely because a policy page exists. If the site’s data practices or jurisdiction are unknown, keep relevant items pending and explain what information the owner must provide.



\---



\## Final Self-Review



Before delivery, review the result against these five dimensions:



1\. \*\*Design direction:\*\* Does the interface feel coherent rather than assembled from unrelated effects?

2\. \*\*Visual hierarchy:\*\* Is the intended content clearly dominant?

3\. \*\*Craft:\*\* Are spacing, type, color, alignment, and states consistent?

4\. \*\*Functionality:\*\* Do the implemented elements work and serve a purpose?

5\. \*\*Originality:\*\* Does the result avoid generic templates while still fitting the brief?



Fix obvious issues before delivery. When the user asks for a critique or score, report the findings directly and prioritize actionable fixes.



The final response should be concise: point to the changed work, the updated `README.md`, any meaningful verification performed, and any pending owner or legal actions.

