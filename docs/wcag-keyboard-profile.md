# WCAG 2.2 Keyboard and Navigation Profile

KeyWise Web focuses on a **subset** of WCAG 2.2 success criteria that relate to keyboard operation
and navigation. This profile defines what the tool aspires to help inspect. It is a scope statement,
not a conformance claim — see [limitations.md](limitations.md).

All criteria below are Level A or AA.

## 2.1.1 Keyboard (A)

All functionality must be operable through a keyboard. KeyWise Web aims to help identify controls
that respond to the mouse but cannot be reached or activated via the keyboard.

## 2.1.2 No Keyboard Trap (A)

Keyboard focus must be able to move away from any component using only the keyboard. KeyWise Web aims
to help surface places where focus appears to get stuck (for example, some modal dialogs).

## 2.4.1 Bypass Blocks (A)

Users must be able to bypass repeated blocks of content (e.g. navigation). KeyWise Web aims to help
detect the absence of skip links and main landmarks.

## 2.4.3 Focus Order (A)

The order in which components receive focus must preserve meaning and operability. KeyWise Web aims
to help visualize tab order and flag distortions such as positive `tabindex` values.

## 2.4.6 Headings and Labels (AA)

Headings and labels must describe topic or purpose. KeyWise Web aims to help highlight missing or
unhelpful headings and labels.

## 2.4.7 Focus Visible (AA)

The keyboard focus indicator must be visible. KeyWise Web aims to help identify elements that lose
their visible focus indicator and to optionally provide a passive focus helper.

## 2.4.11 Focus Not Obscured (Minimum) (AA)

When an element receives focus, it must not be entirely hidden by author-created content (such as
sticky headers). KeyWise Web aims to help surface cases where the focused element is obscured.

## 3.3.2 Labels or Instructions (A)

Labels or instructions must be provided when content requires user input. KeyWise Web aims to help
detect form fields without associated labels or instructions.

## 4.1.2 Name, Role, Value (A)

For all UI components, the name and role must be programmatically determinable. KeyWise Web aims to
help detect interactive elements that lack an accessible name or appropriate role.

---

The placeholder rule catalog in `@keywise/wcag-rules` maps proposed checks to these criteria. Every
rule is currently marked `not-implemented`.
