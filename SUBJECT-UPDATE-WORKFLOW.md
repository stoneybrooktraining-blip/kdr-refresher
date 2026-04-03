# Adding a New Subject to KDR Refresher

This workflow explains how to add a new subject (e.g., CPL Human Factors, ATPL Law) to the KDR Refresher tool. The npm script automates the index.html update.

## Quick Workflow

### 1. Build the JSON file
Create a new file in `data/` with all syllabus codes from the official AC spec.

**Example:** `data/cpl-hf.json` (399 entries for CPL Human Factors)

Validate:
- ✓ Flat array format `[{...}, {...}]`
- ✓ Each entry has: `code`, `topic`, `syllabus_desc`, `concept`, `exam_tip`, `key_facts`, `source`, `confidence`, `verified: false`
- ✓ No duplicate codes
- ✓ No curly quotes (all straight quotes)
- ✓ Valid JSON (no syntax errors)

### 2. Upload JSON to GitHub
Go to https://github.com/stoneybrooktraining-blip/kdr-refresher/tree/main/data

Click **Add file** → **Upload files** → drag your JSON file

Commit with message: "Add [subject] KDR content (Subject XX)"

### 3. Run the update script
In your terminal, navigate to the `kdr-refresher` directory and run:

```bash
npm run update-subject <subject-number> <json-filename>
```

**Examples:**

```bash
# CPL Human Factors
npm run update-subject 34 cpl-hf.json

# ATPL Air Law
npm run update-subject 40 atpl-law.json

# IR Meteorology
npm run update-subject 50 ir-met.json
```

The script will:
- Detect the exam type from the filename (cpl-, atpl-, ir-, ppl-)
- Find the subject in CONFIG.subjectMapping
- Add the exam-specific property (cplAcNum, atplAcNum, irAcNum)
- Add the JSON file reference to CONFIG.contentFiles[examType]
- Report success

**Expected output:**
```
Detected exam type: CPL
Found subject: human factors
✓ Edit 1: Added cplAcNum: '34' to 'human factors'
✓ Edit 2: Added '34': 'data/cpl-hf.json' to CPL contentFiles

✅ Successfully updated index.html (+62 bytes)
   Subject: human factors
   Exam Type: CPL
   Subject Number: 34
   JSON file: data/cpl-hf.json

Next step: Upload the updated index.html to GitHub
```

### 4. Upload updated index.html
Go to https://github.com/stoneybrooktraining-blip/kdr-refresher

Click **Add file** → **Upload files** → drag the updated `index.html` from your local `kdr-refresher` folder

Commit with message: "Add [subject] mapping to index.html"

### 5. Wait for GitHub Pages to redeploy
Takes about 1 minute. You'll see a ✅ in the Deployments section.

### 6. Test
Upload a KDR Refresher PDF with that subject and verify it works!

---

## What Each File Does

| File | Purpose |
|------|---------|
| `data/cpl-hf.json` | Content database — all 399 syllabus codes for CPL Human Factors |
| `index.html` | Main app file with CONFIG.subjectMapping and CONFIG.contentFiles that tell the app where to find each subject's JSON |
| `scripts/update-index-for-subject.js` | Automation script that updates index.html whenever you add a new subject |
| `package.json` | Node configuration that defines the `npm run update-subject` command |

## Supported Exam Types & Subjects

### PPL (Pilot Licence)
- 10: Human Factors (ppl-hf.json)
- 12: Aircraft Technical Knowledge (ppl-atk.json)
- 14: Aircraft Technical Knowledge - Helicopter (ppl-atk-heli.json)
- 2: Flight Radiotelephony (ppl-frto.json)
- 4: Air Law (ppl-law.json)
- 6: Flight Navigation (ppl-nav.json)
- 8: Meteorology (ppl-met.json)

### CPL (Commercial Pilot)
- 16: Air Law (cpl-law.json) ← ac061-3 subject 1
- 26: Aircraft Technical Knowledge (cpl-atk.json) ← ac061-3 subject 2
- 28: Aircraft Technical Knowledge - Helicopter (cpl-atk-heli.json) ← ac061-3 subject 3
- 34: Human Factors (cpl-hf.json) ← ac061-5 subject 34

### ATPL (Air Transport Pilot)
*To be added as you build them — follow the same workflow*

### IR (Instrument Rating)
*To be added as you build them — follow the same workflow*

## File Format Example

**cpl-hf.json structure:**
```json
[
  {
    "code": "34.2.2",
    "topic": "Basic Principles of Human Factors",
    "syllabus_desc": "Understand the basic concepts of human factors and how they affect aviation safety",
    "concept": "Human factors is the study of how people interact with their environment...",
    "exam_tip": "Be able to explain why human factors is important in aviation",
    "key_facts": [
      "Error is human – mistakes happen even with well-trained pilots",
      "Situational awareness is crucial for safety",
      "Fatigue degrades performance"
    ],
    "source": "AC 61-5 Rev 38, page 171",
    "confidence": false,
    "verified": false,
    "created": "2026-03-31T16:00:00Z"
  },
  ...
]
```

## Troubleshooting

**"Could not detect exam type"**
- Filename must start with: `cpl-`, `atpl-`, `ir-`, or `ppl-`
- Example: `cpl-hf.json` ✓ | `cpf-hf.json` ✗

**"Could not find a subject with prefix"**
- The subject doesn't exist yet
- You may need to add it manually to CONFIG.subjectMapping first
- Contact support if unsure

**"Property already exists"**
- The exam-specific mapping is already there
- No action needed — contentFiles entry will still be updated

**index.html not updating in the browser**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- GitHub Pages can take up to 2 minutes to redeploy
- Check the Deployments section in the repo to see deployment status

---

## Questions?

Refer to `UPDATE-INDEX-README.md` for detailed script documentation.
