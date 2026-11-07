# Scales: the human round

The machine audit says whether each job works and what it costs. Only people can say whether Scales is easy to
learn and worth coming back to. This round takes about 15 minutes per person. Run it with each tester (Matt first),
on their own phone, with the current TestFlight build.

## Setup

- Fresh install, or delete and reinstall so it starts empty.
- Watch, don't help. If they ask "what do I do?", answer "What would you try?" and note it.
- Time each task from "go" to done or given up. Note every hesitation over 3 seconds and every wrong gesture.

## Five tasks

Read each one out as written. Don't name a gesture or a button.

| # | Say this | Done when | Watch for |
|---|---|---|---|
| T1 | "Put three thoughts of your own into the app." | Three thoughts kept | Do they find + New after the first one? |
| T2 | "Go through today's thoughts until you've seen five." | Five cards met | Do they discover swipe up without the hint? |
| T3 | "One of these you're done with. Get it out of the way." | One put away | Do they pull down, or look for a button? Do they trust Undo? |
| T4 | "Change the wording of one thought and add a note to it." | Edit saved with a note | Do they tap the thought? Do they find Add a note? |
| T5 | "Find the thought you put away and bring it back." | It is back in rotation | Do they look in Your thoughts? Do they find the Put away row? |

After each task ask: **"How easy or hard was that, from 1 (very hard) to 7 (very easy)?"** (Single Ease Question.
Below 5 is a problem worth fixing.)

## Afterwards: the SUS questionnaire

Ten statements, each answered 1 (strongly disagree) to 5 (strongly agree). Read them in this order; the wording is
the standard System Usability Scale with "Scales" in place of "this system".

1. I think that I would like to use Scales frequently.
2. I found Scales unnecessarily complex.
3. I thought Scales was easy to use.
4. I think that I would need the support of a technical person to be able to use Scales.
5. I found the various functions in Scales were well integrated.
6. I thought there was too much inconsistency in Scales.
7. I would imagine that most people would learn to use Scales very quickly.
8. I found Scales very cumbersome to use.
9. I felt very confident using Scales.
10. I needed to learn a lot of things before I could get going with Scales.

**Scoring:** for odd items subtract 1 from the answer; for even items subtract the answer from 5. Add the ten
results and multiply by 2.5. The score runs 0 to 100.

| SUS | Reads as |
|---|---|
| 80 and up | Excellent: people recommend it |
| 68 | Average |
| Under 50 | People will struggle |

## Two open questions to finish

1. "What did you expect to happen that didn't?"
2. "If you stopped using it next week, what would be the reason?"

## Recording

One row per person, kept in the private Claude doc for Scales testing (never in this public repo):

| Tester | Date | T1-T5 time (s) | T1-T5 ease (1-7) | Wrong gestures | SUS | Expected but didn't happen | Reason they'd stop |
|---|---|---|---|---|---|---|---|

Two or three testers find most of the big problems. Five find about 85% of them.
