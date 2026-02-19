import type { DocumentTemplate } from "../../types";

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "motion-to-compel",
    name: "Motion to Compel Discovery",
    category: "Motions",
    fields: [
      { name: "courtName", label: "Court Name", type: "text", required: true },
      {
        name: "caseNumber",
        label: "Case Number",
        type: "text",
        required: true,
      },
      {
        name: "plaintiffName",
        label: "Plaintiff Name",
        type: "text",
        required: true,
      },
      {
        name: "defendantName",
        label: "Defendant Name",
        type: "text",
        required: true,
      },
      {
        name: "discoveryType",
        label: "Type of Discovery",
        type: "select",
        required: true,
        options: [
          "Interrogatories",
          "Requests for Production",
          "Requests for Admission",
          "Deposition",
        ],
      },
      {
        name: "dateSent",
        label: "Date Discovery Sent",
        type: "date",
        required: true,
      },
      {
        name: "description",
        label: "Description of Outstanding Discovery",
        type: "textarea",
        required: true,
      },
    ],
    outputFormat: `VIRGINIA: IN THE {{courtName}}

{{plaintiffName}},
  Plaintiff,
                              Case No. {{caseNumber}}
v.

{{defendantName}},
  Defendant.

MOTION TO COMPEL DISCOVERY

COMES NOW the Plaintiff, {{plaintiffName}}, pro se, and moves this Honorable Court pursuant to Rule 4:12 of the Rules of the Supreme Court of Virginia to compel the Defendant to respond to discovery, and in support thereof states as follows:

1. On {{dateSent}}, the Plaintiff served {{discoveryType}} upon the Defendant.

2. To date, the Defendant has failed to provide adequate responses as required by the Rules of the Supreme Court of Virginia.

3. The outstanding discovery concerns: {{description}}

4. The Plaintiff has made good faith efforts to resolve this dispute without court intervention.

WHEREFORE, the Plaintiff respectfully requests that this Court:
a) Order the Defendant to respond to the outstanding discovery within fourteen (14) days;
b) Award the Plaintiff reasonable expenses incurred in making this motion; and
c) Grant such other relief as the Court deems just and proper.

Respectfully submitted,

_______________________________
{{plaintiffName}}, Pro Se

CERTIFICATE OF SERVICE

I hereby certify that on this date, a true copy of the foregoing was served upon {{defendantName}} by [method of service].

_______________________________
{{plaintiffName}}
Date: _______________`,
  },
  {
    id: "motion-for-continuance",
    name: "Motion for Continuance",
    category: "Motions",
    fields: [
      { name: "courtName", label: "Court Name", type: "text", required: true },
      {
        name: "caseNumber",
        label: "Case Number",
        type: "text",
        required: true,
      },
      {
        name: "plaintiffName",
        label: "Plaintiff Name",
        type: "text",
        required: true,
      },
      {
        name: "defendantName",
        label: "Defendant Name",
        type: "text",
        required: true,
      },
      {
        name: "hearingDate",
        label: "Current Hearing Date",
        type: "date",
        required: true,
      },
      {
        name: "reason",
        label: "Reason for Continuance",
        type: "textarea",
        required: true,
      },
    ],
    outputFormat: `VIRGINIA: IN THE {{courtName}}

{{plaintiffName}},
  Plaintiff,
                              Case No. {{caseNumber}}
v.

{{defendantName}},
  Defendant.

MOTION FOR CONTINUANCE

COMES NOW {{plaintiffName}}, pro se, and respectfully moves this Honorable Court for a continuance of the hearing currently scheduled for {{hearingDate}}, and in support thereof states as follows:

1. This matter is currently set for hearing on {{hearingDate}}.

2. A continuance is necessary because: {{reason}}

3. This motion is made in good faith and not for the purpose of delay.

4. The undersigned has [contacted/attempted to contact] opposing counsel/party regarding this request.

WHEREFORE, the movant respectfully requests that the Court grant this Motion for Continuance and reschedule the hearing to a date convenient to the Court and all parties.

Respectfully submitted,

_______________________________
{{plaintiffName}}, Pro Se

CERTIFICATE OF SERVICE

I hereby certify that on this date, a true copy of the foregoing was served upon {{defendantName}} by [method of service].

_______________________________
{{plaintiffName}}
Date: _______________`,
  },
  {
    id: "answer",
    name: "Answer to Complaint",
    category: "Pleadings",
    fields: [
      { name: "courtName", label: "Court Name", type: "text", required: true },
      {
        name: "caseNumber",
        label: "Case Number",
        type: "text",
        required: true,
      },
      {
        name: "plaintiffName",
        label: "Plaintiff Name",
        type: "text",
        required: true,
      },
      {
        name: "defendantName",
        label: "Defendant Name (You)",
        type: "text",
        required: true,
      },
      {
        name: "responses",
        label: "Responses to Allegations (numbered)",
        type: "textarea",
        required: true,
      },
      {
        name: "defenses",
        label: "Affirmative Defenses",
        type: "textarea",
        required: false,
      },
    ],
    outputFormat: `VIRGINIA: IN THE {{courtName}}

{{plaintiffName}},
  Plaintiff,
                              Case No. {{caseNumber}}
v.

{{defendantName}},
  Defendant.

ANSWER

COMES NOW the Defendant, {{defendantName}}, pro se, and for their Answer to the Complaint, states as follows:

RESPONSES TO ALLEGATIONS

{{responses}}

AFFIRMATIVE DEFENSES

{{defenses}}

WHEREFORE, the Defendant respectfully requests that the Court deny the relief sought by the Plaintiff and grant such other relief as the Court deems just and proper.

Respectfully submitted,

_______________________________
{{defendantName}}, Pro Se

CERTIFICATE OF SERVICE

I hereby certify that on this date, a true copy of the foregoing was served upon {{plaintiffName}} by [method of service].

_______________________________
{{defendantName}}
Date: _______________`,
  },
  {
    id: "financial-statement",
    name: "Financial Declaration",
    category: "Financial",
    fields: [
      { name: "courtName", label: "Court Name", type: "text", required: true },
      {
        name: "caseNumber",
        label: "Case Number",
        type: "text",
        required: true,
      },
      { name: "yourName", label: "Your Name", type: "text", required: true },
      { name: "employer", label: "Employer", type: "text", required: true },
      {
        name: "grossMonthly",
        label: "Gross Monthly Income",
        type: "text",
        required: true,
      },
      {
        name: "netMonthly",
        label: "Net Monthly Income",
        type: "text",
        required: true,
      },
      {
        name: "monthlyExpenses",
        label: "Total Monthly Expenses",
        type: "text",
        required: true,
      },
      {
        name: "assets",
        label: "Assets (list)",
        type: "textarea",
        required: false,
      },
      {
        name: "debts",
        label: "Debts (list)",
        type: "textarea",
        required: false,
      },
    ],
    outputFormat: `VIRGINIA: IN THE {{courtName}}
                              Case No. {{caseNumber}}

FINANCIAL DECLARATION OF {{yourName}}

I, {{yourName}}, declare under penalty of perjury that the following is true and correct:

EMPLOYMENT
Employer: {{employer}}

INCOME
Gross Monthly Income: \${{grossMonthly}}
Net Monthly Income: \${{netMonthly}}

MONTHLY EXPENSES
Total Monthly Expenses: \${{monthlyExpenses}}

ASSETS
{{assets}}

DEBTS AND LIABILITIES
{{debts}}

I declare under penalty of perjury under the laws of the Commonwealth of Virginia that the foregoing is true and correct.

_______________________________
{{yourName}}
Date: _______________`,
  },
  {
    id: "affidavit",
    name: "General Affidavit",
    category: "Supporting Documents",
    fields: [
      {
        name: "affiantName",
        label: "Your Name (Affiant)",
        type: "text",
        required: true,
      },
      { name: "county", label: "County/City", type: "text", required: true },
      {
        name: "statements",
        label: "Sworn Statements (numbered)",
        type: "textarea",
        required: true,
      },
    ],
    outputFormat: `AFFIDAVIT OF {{affiantName}}

COMMONWEALTH OF VIRGINIA
COUNTY/CITY OF {{county}}

I, {{affiantName}}, being first duly sworn, depose and state as follows:

{{statements}}

Further affiant sayeth not.

_______________________________
{{affiantName}}

Sworn to and subscribed before me this _____ day of _____________, 20_____.

_______________________________
Notary Public
My commission expires: _______________`,
  },
  {
    id: "subpoena-duces-tecum",
    name: "Subpoena Duces Tecum",
    category: "Discovery",
    fields: [
      { name: "courtName", label: "Court Name", type: "text", required: true },
      {
        name: "caseNumber",
        label: "Case Number",
        type: "text",
        required: true,
      },
      {
        name: "plaintiffName",
        label: "Plaintiff Name",
        type: "text",
        required: true,
      },
      {
        name: "defendantName",
        label: "Defendant Name",
        type: "text",
        required: true,
      },
      {
        name: "recipientName",
        label: "Person/Entity to Produce Documents",
        type: "text",
        required: true,
      },
      {
        name: "documents",
        label: "Documents Requested (list)",
        type: "textarea",
        required: true,
      },
      {
        name: "produceDate",
        label: "Date to Produce",
        type: "date",
        required: true,
      },
    ],
    outputFormat: `VIRGINIA: IN THE {{courtName}}

{{plaintiffName}},
  Plaintiff,
                              Case No. {{caseNumber}}
v.

{{defendantName}},
  Defendant.

SUBPOENA DUCES TECUM

TO: {{recipientName}}

YOU ARE HEREBY COMMANDED to produce the following documents and tangible things on or before {{produceDate}}:

{{documents}}

These documents are to be produced at:
[Address]

Failure to comply with this subpoena may result in sanctions by the Court.

Issued this _____ day of _____________, 20_____.

_______________________________
Clerk of Court

Requested by:
{{plaintiffName}}, Pro Se`,
  },
];
