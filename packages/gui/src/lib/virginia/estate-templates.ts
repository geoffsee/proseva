import type { DocumentTemplate } from "../../types";

export const ESTATE_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "last-will",
    name: "Last Will and Testament",
    description:
      "Virginia-compliant last will and testament. Must be signed by the testator and two competent witnesses per Va. Code §§ 64.2-400, 64.2-403. A self-proving affidavit (Va. Code § 64.2-452) is recommended.",
    category: "Estate Planning",
    fields: [
      {
        name: "testatorName",
        label: "Testator (Your Full Legal Name)",
        type: "text",
        required: true,
      },
      {
        name: "county",
        label: "County/City of Residence",
        type: "text",
        required: true,
      },
      {
        name: "executorName",
        label: "Executor Name",
        type: "text",
        required: true,
      },
      {
        name: "alternateExecutor",
        label: "Alternate Executor Name",
        type: "text",
        required: false,
      },
      {
        name: "guardianName",
        label: "Guardian for Minor Children (if applicable)",
        type: "text",
        required: false,
      },
      {
        name: "specificBequests",
        label: "Specific Bequests (list items and recipients)",
        type: "textarea",
        required: false,
      },
      {
        name: "residuaryBeneficiary",
        label: "Residuary Beneficiary (receives everything else)",
        type: "text",
        required: true,
      },
      {
        name: "alternateResiduaryBeneficiary",
        label: "Alternate Residuary Beneficiary",
        type: "text",
        required: false,
      },
    ],
    outputFormat: `LAST WILL AND TESTAMENT OF {{testatorName}}

I, {{testatorName}}, a resident of {{county}}, Commonwealth of Virginia, being of sound mind and disposing memory, and not acting under duress, menace, fraud, or undue influence, do hereby declare this to be my Last Will and Testament, revoking all prior wills and codicils.

ARTICLE I — IDENTIFICATION
I declare that I am a resident of {{county}}, Virginia.

ARTICLE II — DEBTS AND EXPENSES
I direct my Executor to pay all my legally enforceable debts, funeral expenses, and costs of administration from my estate as soon as practicable.

ARTICLE III — SPECIFIC BEQUESTS
{{specificBequests}}

ARTICLE IV — RESIDUARY ESTATE
I give, devise, and bequeath all the rest, residue, and remainder of my estate, of whatever kind and wherever situated, to {{residuaryBeneficiary}}. If {{residuaryBeneficiary}} does not survive me, I give the residuary estate to {{alternateResiduaryBeneficiary}}.

ARTICLE V — EXECUTOR
I appoint {{executorName}} as Executor of this Will. If {{executorName}} is unable or unwilling to serve, I appoint {{alternateExecutor}} as alternate Executor. I direct that no bond or security be required of any Executor serving hereunder, to the extent permitted by Virginia law.

ARTICLE VI — GUARDIAN
I appoint {{guardianName}} as guardian of the person and property of any minor children surviving me.

ARTICLE VII — POWERS
I grant my Executor full power and authority as permitted under the Virginia Uniform Trust Code and the laws of Virginia, including but not limited to the power to sell, lease, mortgage, or otherwise dispose of estate property, to invest and reinvest estate assets, and to settle claims.

IN WITNESS WHEREOF, I have signed this Will on this _____ day of _____________, 20_____.


_______________________________
{{testatorName}}, Testator

ATTESTATION CLAUSE

We declare that the person who signed this Will, or asked another to sign for them, did so in our presence, and that we believe this person to be of sound mind. We each sign this Will as witnesses in the presence of the testator and in the presence of each other, on this _____ day of _____________, 20_____.

_______________________________    _______________________________
Witness 1 Signature                Witness 2 Signature
Name: _________________________    Name: _________________________
Address: _______________________    Address: _______________________

SELF-PROVING AFFIDAVIT (Va. Code § 64.2-452)

STATE OF VIRGINIA
COUNTY/CITY OF {{county}}

Before me, the undersigned authority, personally appeared {{testatorName}}, the Testator, and the above-named witnesses, known to me to be the Testator and witnesses whose names are signed to the foregoing instrument, and all being duly sworn, the Testator declared that the instrument is the Testator's Will, and that the Testator signed it willingly. Each witness declared that they signed the Will as witness in the presence and at the request of the Testator.

_______________________________
Notary Public
My commission expires: _______________`,
  },
  {
    id: "power-of-attorney-financial",
    name: "Durable Power of Attorney - Financial",
    description:
      "Virginia Uniform Power of Attorney Act (Va. Code § 64.2-1600 et seq.). This document remains effective even if the principal becomes incapacitated.",
    category: "Estate Planning",
    fields: [
      {
        name: "principalName",
        label: "Principal (Your Full Legal Name)",
        type: "text",
        required: true,
      },
      {
        name: "county",
        label: "County/City of Residence",
        type: "text",
        required: true,
      },
      {
        name: "agentName",
        label: "Agent (Attorney-in-Fact) Name",
        type: "text",
        required: true,
      },
      {
        name: "alternateAgent",
        label: "Alternate Agent Name",
        type: "text",
        required: false,
      },
      {
        name: "powers",
        label:
          "Specific Powers Granted (or 'all powers under Va. Code § 64.2-1622')",
        type: "textarea",
        required: true,
      },
      {
        name: "limitations",
        label: "Limitations on Powers (if any)",
        type: "textarea",
        required: false,
      },
    ],
    outputFormat: `DURABLE POWER OF ATTORNEY — FINANCIAL

NOTICE: THIS IS AN IMPORTANT LEGAL DOCUMENT. BEFORE SIGNING, YOU SHOULD UNDERSTAND THAT THIS DOCUMENT GRANTS YOUR AGENT BROAD POWERS TO HANDLE YOUR PROPERTY AND FINANCES.

I, {{principalName}}, a resident of {{county}}, Commonwealth of Virginia, hereby appoint {{agentName}} as my agent (attorney-in-fact) to act on my behalf in financial matters.

If {{agentName}} is unable or unwilling to serve, I appoint {{alternateAgent}} as my alternate agent.

DURABILITY: THIS POWER OF ATTORNEY SHALL NOT BE AFFECTED BY MY SUBSEQUENT DISABILITY OR INCAPACITY, pursuant to Va. Code § 64.2-1600 et seq.

POWERS GRANTED:
{{powers}}

LIMITATIONS:
{{limitations}}

EFFECTIVE DATE: This power of attorney is effective immediately upon signing and shall remain in effect until revoked by me in writing.

THIRD PARTY RELIANCE: Any third party who receives a copy of this document may rely upon it as if it were an original. Any third party may rely on the representations of my agent regarding matters relating to powers granted herein.

IN WITNESS WHEREOF, I have signed this Durable Power of Attorney on this _____ day of _____________, 20_____.


_______________________________
{{principalName}}, Principal

ACKNOWLEDGMENT

STATE OF VIRGINIA
COUNTY/CITY OF {{county}}

This instrument was acknowledged before me on this _____ day of _____________, 20_____, by {{principalName}}.

_______________________________
Notary Public
My commission expires: _______________`,
  },
  {
    id: "advance-medical-directive",
    name: "Advance Medical Directive",
    description:
      "Virginia Advance Medical Directive combining a living will and healthcare power of attorney, per Va. Code § 54.1-2981 et seq. Also known as the Virginia Health Care Decisions Act.",
    category: "Estate Planning",
    fields: [
      {
        name: "declarantName",
        label: "Declarant (Your Full Legal Name)",
        type: "text",
        required: true,
      },
      {
        name: "agentName",
        label: "Healthcare Agent Name",
        type: "text",
        required: true,
      },
      {
        name: "agentPhone",
        label: "Healthcare Agent Phone",
        type: "text",
        required: false,
      },
      {
        name: "alternateAgent",
        label: "Alternate Healthcare Agent",
        type: "text",
        required: false,
      },
      {
        name: "treatmentPreferences",
        label: "Treatment Preferences and End-of-Life Wishes",
        type: "textarea",
        required: true,
      },
      {
        name: "organDonation",
        label: "Organ Donation Wishes",
        type: "select",
        required: true,
        options: [
          "I wish to donate any needed organs/tissues",
          "I wish to donate only the following organs/tissues",
          "I do not wish to donate organs/tissues",
        ],
      },
    ],
    outputFormat: `ADVANCE MEDICAL DIRECTIVE
(Pursuant to Va. Code § 54.1-2981 et seq.)

I, {{declarantName}}, willfully and voluntarily make known my wishes in the event that I am diagnosed with a terminal condition, am in a persistent vegetative state, or am in an end-stage condition and am unable to make decisions regarding my medical care.

PART I — APPOINTMENT OF HEALTHCARE AGENT

I hereby appoint {{agentName}} (Phone: {{agentPhone}}) as my agent to make health care decisions on my behalf as authorized in this document.

If {{agentName}} is unable or unwilling to serve, I appoint {{alternateAgent}} as my alternate agent.

My agent shall have the authority to make all health care decisions for me, including decisions about life-prolonging procedures, to the extent I could make such decisions for myself, if I become incapable of making an informed decision.

PART II — TREATMENT PREFERENCES

If at any time I should have a terminal condition, be in a persistent vegetative state, or be in an end-stage condition, as determined by my attending physician, I make the following declaration:

{{treatmentPreferences}}

PART III — ORGAN DONATION

{{organDonation}}

PART IV — GENERAL PROVISIONS

I understand that I have the right to revoke this advance directive at any time. This directive shall remain in effect until revoked.

Signed this _____ day of _____________, 20_____.


_______________________________
{{declarantName}}, Declarant

The declarant signed the foregoing advance directive in my presence:

_______________________________    _______________________________
Witness 1 Signature                Witness 2 Signature
Name: _________________________    Name: _________________________`,
  },
  {
    id: "revocable-living-trust",
    name: "Revocable Living Trust Summary",
    description:
      "Summary outline for a Virginia revocable living trust per Va. Code § 64.2-700 et seq. This template creates a summary document; a full trust instrument should be reviewed by an attorney.",
    category: "Estate Planning",
    fields: [
      {
        name: "trustorName",
        label: "Trustor/Grantor Name",
        type: "text",
        required: true,
      },
      {
        name: "trusteeName",
        label: "Trustee Name",
        type: "text",
        required: true,
      },
      {
        name: "successorTrustee",
        label: "Successor Trustee Name",
        type: "text",
        required: true,
      },
      { name: "trustName", label: "Trust Name", type: "text", required: true },
      {
        name: "trustPurpose",
        label: "Trust Purpose",
        type: "textarea",
        required: true,
      },
      {
        name: "trustAssets",
        label: "Assets to be Transferred to Trust",
        type: "textarea",
        required: true,
      },
      {
        name: "beneficiaryInstructions",
        label: "Distribution Instructions for Beneficiaries",
        type: "textarea",
        required: true,
      },
    ],
    outputFormat: `REVOCABLE LIVING TRUST SUMMARY
{{trustName}}

(Reference: Va. Code § 64.2-700 et seq.)

DISCLAIMER: This is a summary document for planning purposes. A complete trust instrument should be prepared with legal assistance.

TRUST IDENTIFICATION
Trust Name: {{trustName}}
Trustor/Grantor: {{trustorName}}
Initial Trustee: {{trusteeName}}
Successor Trustee: {{successorTrustee}}

PURPOSE
{{trustPurpose}}

TRUST ASSETS
The following assets are to be transferred into the trust:
{{trustAssets}}

REVOCABILITY
This trust is revocable. The Trustor reserves the right to amend, modify, or revoke this trust in whole or in part during the Trustor's lifetime, pursuant to Va. Code § 64.2-747.

DISTRIBUTION PROVISIONS
{{beneficiaryInstructions}}

ADMINISTRATION
The Trustee shall manage the trust property for the benefit of the beneficiaries. The Trustee has the powers granted under the Virginia Uniform Trust Code (Va. Code § 64.2-700 et seq.), including the power to invest, reinvest, sell, lease, and distribute trust property.

GOVERNING LAW
This trust shall be governed by the laws of the Commonwealth of Virginia.

Date: _______________

_______________________________
{{trustorName}}, Trustor/Grantor`,
  },
];
