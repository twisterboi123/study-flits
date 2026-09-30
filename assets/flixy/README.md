# Flixy Rive asset

Place the exported Rive file at `assets/flixy/flixy.riv`.

In the Rive editor, create a state machine named `FlixyStateMachine` and add
trigger inputs: `happy`, `sad`, `talking`, `thinking`, `correct`, `wrong`, and
`excited`. Add optional Boolean inputs `isTalking` and `isThinking`, plus the
optional Number input `talkAmount` (0–1) for beak openness during speech.

Build one consistent vector character: lime-green round body, darker-green
outline/shading, black eyes with highlights, orange upper and lower beak,
wings and feet. Rig the body, wings, eyes, eyelids, pupils, beak and feet.

Create smooth idle, happy, correct, sad, wrong, talking, thinking and excited
states. The JavaScript controller in `components/flixy/flixyController.js`
loads this file and exposes `setFlixyState('correct')`, `setFlixyState('wrong')`
and the other states to the website.
