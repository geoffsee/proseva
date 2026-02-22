import { StandardFonts } from "pdf-lib";

export const documentPresets = {
    "divorce-complaint": {
        title: "COMPLAINT FOR DIVORCE",
        pages: 3,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        // Now written in Markdown-friendly format
        body: (info: any) => `
**COMES NOW** the Plaintiff, **${info.plaintiff}**, and for cause of action states as follows:

1. The Plaintiff is an actual bona fide resident of the Commonwealth of Virginia and has been for more than six months immediately preceding the filing of this Complaint.

2. The parties were lawfully married on ${info.marriageDate || 'June 15, 2018'}, in the City of Newport News, Virginia.

3. There are no minor children born of the marriage.

4. The parties have lived separate and apart, without any cohabitation and without interruption, for a period of one year immediately preceding the filing of this Complaint.

5. There is no reasonable likelihood of reconciliation.

**WHEREFORE**, the Plaintiff prays that:

a. A divorce **a vinculo matrimonii** be granted pursuant to § 20-91(A)(9)(a) of the Code of Virginia;

b. Equitable distribution of marital property be awarded pursuant to § 20-107.3;

c. The Plaintiff be awarded spousal support (or reservation thereof);

d. Each party retain their respective personal property;

e. The Plaintiff be awarded attorney’s fees and costs; and

f. For such other and further relief as the Court deems proper.
  `.trim(),
        hasAttorneySignature: true,
    },

    "answer-to-complaint": {
        title: "ANSWER TO COMPLAINT FOR DIVORCE",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**COMES NOW** the Defendant, **${info.defendant}**, and for his/her Answer to the Complaint for Divorce filed herein states as follows:

1. The Defendant admits the allegations contained in Paragraphs 1, 2, and 3 of the Complaint.

2. The Defendant admits the allegations contained in Paragraph 4 of the Complaint.

3. The Defendant admits that there is no reasonable likelihood of reconciliation.

**WHEREFORE**, having fully answered the Complaint, the Defendant prays that the relief requested by the Plaintiff be granted (or as modified by any agreement of the parties) and for such other and further relief as this Court may deem just and proper.
  `.trim(),
        hasAttorneySignature: true,
    },

    "marital-settlement-agreement": {
        title: "MARITAL SETTLEMENT AGREEMENT",
        pages: 8,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**MARITAL AND PROPERTY SETTLEMENT AGREEMENT**

This Marital Settlement Agreement (the “Agreement”) is made this ${info.agreementDate || '[Date]'}, by and between **${info.plaintiff}** (“${info.plaintiffGender || 'Wife'}”) and **${info.defendant}** (“${info.defendantGender || 'Husband'}”).

**RECITALS**

WHEREAS, the parties were lawfully married on ${info.marriageDate || 'June 15, 2018'}, in the City of Newport News, Virginia; and

WHEREAS, the parties have no minor children born of the marriage; and

WHEREAS, the parties have lived separate and apart without cohabitation for more than one year; and

WHEREAS, the parties desire to settle all issues between them relating to property rights, spousal support, and all other rights and obligations arising out of the marital relationship;

NOW, THEREFORE, in consideration of the mutual promises and covenants herein, the parties agree as follows:

1. **DIVORCE**. Either party may proceed with a no-fault divorce pursuant to § 20-91(A)(9)(a) of the Code of Virginia.

2. **PROPERTY DIVISION**. Each party shall retain sole ownership of all property currently in his/her name or possession. Marital property has been equitably divided by mutual agreement.

3. **DEBTS**. Each party shall be solely responsible for any debts incurred in his/her individual name after the date of separation.

4. **SPOUSAL SUPPORT**. ${info.plaintiff} waives any claim to spousal support from ${info.defendant}, and vice versa (or as otherwise agreed: ${info.spousalSupportClause || 'reserved'}).

5. **FULL AND FINAL SETTLEMENT**. This Agreement constitutes a full and final settlement of all claims between the parties.

**IN WITNESS WHEREOF**, the parties have executed this Agreement on the date first above written.
  `.trim(),
        hasAttorneySignature: false, // parties sign and usually notarize
    },

    "final-decree-of-divorce": {
        title: "FINAL DECREE OF DIVORCE",
        pages: 3,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
This cause came on to be heard upon the Complaint for Divorce filed by **${info.plaintiff}**, the Answer filed by **${info.defendant}**, and upon the evidence and arguments presented.

The Court, having considered the same, finds that it has jurisdiction over the parties and the subject matter, and that the grounds for divorce have been proven.

**IT IS THEREFORE ADJUDGED, ORDERED, AND DECREED** that:

a. A divorce **a vinculo matrimonii** is hereby granted to the Plaintiff from the Defendant pursuant to § 20-91(A)(9)(a) of the Code of Virginia.

b. The Marital Settlement Agreement dated ${info.agreementDate || '[Date]'} is hereby affirmed, ratified, and incorporated by reference into this Decree (but not merged).

c. Each party shall retain his/her respective personal property as provided in the Agreement.

d. Spousal support is awarded/reserved as set forth in the Agreement.

**NOTICE REGARDING BENEFICIARY DESIGNATIONS**  
(Bold as required by § 20-111.1(E) of the Code of Virginia): Beneficiary designations for death benefits on life insurance, retirement plans, etc., may or may not be revoked by operation of law.

Entered this ___ day of __________, 20__.

___________________________  
Judge
  `.trim(),
        hasAttorneySignature: false, // court/judge signature
    },

    "plaintiffs-affidavit": {
        title: "AFFIDAVIT IN SUPPORT OF COMPLAINT FOR DIVORCE",
        pages: 1,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
COMMONWEALTH OF VIRGINIA  
CITY OF NEWPORT NEWS, to-wit:

I, **${info.plaintiff}**, being first duly sworn, depose and say:

1. I am the Plaintiff in the above-styled cause and have read the Complaint for Divorce filed herein.

2. The facts stated in the Complaint are true and correct to the best of my knowledge and belief.

3. The parties have lived separate and apart without any cohabitation and without interruption since ${info.separationDate || 'one year immediately preceding filing'}.

4. There is no reasonable likelihood of reconciliation.

Further affiant saith not.

___________________________  
${info.plaintiff}

Subscribed and sworn to before me this ___ day of __________, 20__.

___________________________  
Notary Public
My commission expires: __________
  `.trim(),
        hasAttorneySignature: false,
    },

    "motion-for-pendente-lite": {
        title: "MOTION FOR PENDENTE LITE RELIEF",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**COMES NOW** the Plaintiff, **${info.plaintiff}**, by counsel, and respectfully moves this Court for pendente lite relief as follows:

1. That the Defendant be ordered to pay temporary spousal support in the amount of $________ per month commencing [date].

2. That the Plaintiff be awarded exclusive use and possession of the marital residence located at [address].

3. That the Defendant maintain health insurance coverage for the Plaintiff pending final divorce.

**WHEREFORE**, the Plaintiff prays that this Motion be granted and for such other and further relief as the Court deems just and proper.

A hearing on this Motion is requested at the earliest convenience of the Court.
  `.trim(),
        hasAttorneySignature: true,
    },
    "divorce-complaint-with-children": {
        title: "COMPLAINT FOR DIVORCE",
        pages: 4,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**COMES NOW** the Plaintiff, **${info.plaintiff}**, and for cause of action states as follows:

1. The Plaintiff is an actual bona fide resident of the Commonwealth of Virginia and has been for more than six months immediately preceding the filing of this Complaint.

2. The parties were lawfully married on ${info.marriageDate || 'June 15, 2018'}, in the City of Newport News, Virginia.

3. There are **${info.numberOfChildren || 'two (2)'}** minor children born of the marriage:  
${info.childrenList || '• Child One, born MM/DD/YYYY\n   • Child Two, born MM/DD/YYYY'}.

4. The parties have lived separate and apart, without any cohabitation and without interruption, for a period of one year immediately preceding the filing of this Complaint.

5. There is no reasonable likelihood of reconciliation.

6. It is in the best interests of the minor children (Va. Code § 20-124.3) that custody be awarded as prayed for herein.

**WHEREFORE**, the Plaintiff prays that:

a. A divorce **a vinculo matrimonii** be granted pursuant to § 20-91(A)(9)(a) of the Code of Virginia;

b. **Joint legal custody** be awarded to both parties with **primary physical custody** to the Plaintiff and reasonable visitation to the Defendant;

c. Child support be awarded to the Plaintiff pursuant to the Virginia Child Support Guidelines (§§ 20-108.1 & 20-108.2);

d. The Defendant maintain health insurance for the children and pay his/her share of unreimbursed medical expenses;

e. Equitable distribution of marital property pursuant to § 20-107.3;

f. The Plaintiff be awarded spousal support (or reservation thereof);

g. The Plaintiff be awarded attorney’s fees and costs; and

h. For such other and further relief as the Court deems proper.
  `.trim(),
        hasAttorneySignature: true,
    },

    "motion-for-pendente-lite-custody-support": {
        title: "MOTION FOR PENDENTE LITE CUSTODY, VISITATION, AND SUPPORT",
        pages: 3,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**COMES NOW** the Plaintiff, **${info.plaintiff}**, by counsel, and respectfully moves this Court for pendente lite relief pursuant to Va. Code § 20-103 as follows:

1. That the Plaintiff be awarded **temporary primary physical custody** of the minor children, with **joint legal custody** to both parties.

2. That the Defendant be granted reasonable temporary visitation rights.

3. That the Defendant be ordered to pay temporary **child support** in the amount of **$${info.tempChildSupportAmount || '1,250.00'}** per month (or per the Virginia guidelines).

4. That the Defendant maintain health, dental, and vision insurance coverage for the minor children and pay his/her proportionate share of uninsured medical, dental, and extracurricular expenses.

5. That the Plaintiff be awarded exclusive use and possession of the marital residence located at ${info.residence || '[full address]'}.

**WHEREFORE**, the Plaintiff prays that this Motion be granted and for such other and further relief as the Court deems just and proper.

A hearing on this Motion is requested at the earliest date available to the Court.
  `.trim(),
        hasAttorneySignature: true,
    },

    "parenting-plan-agreement": {
        title: "PARENTING PLAN AGREEMENT",
        pages: 7,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**PARENTING PLAN AGREEMENT**

This Parenting Plan Agreement is made this ${info.agreementDate || '[Date]'}, by and between **${info.plaintiff || 'Mother'}** (“Mother”) and **${info.defendant || 'Father'}** (“Father”).

**RECITALS**

The parties are the parents of the minor children: ${info.childrenList || 'listed above'}.

The parties desire to establish a parenting plan that serves the best interests of the children pursuant to Va. Code § 20-124.2.

**AGREEMENT**

1. **Legal Custody**: The parties shall share **joint legal custody**.

2. **Physical Custody / Parenting Time**:
- Mother shall have primary physical custody.
- Father shall have parenting time every other weekend (Friday 6:00 p.m. – Sunday 6:00 p.m.), one weekday evening per week, alternating holidays, and four (4) weeks of summer vacation.

3. **Child Support**: Father shall pay Mother **$${info.monthlyChildSupport || '1,350.00'}** per month in accordance with the Virginia Child Support Guidelines.

4. **Health Care & Extracurriculars**: The parties shall share unreimbursed medical, dental, and extracurricular expenses ${info.expenseSplit || 'equally (50/50)'}.

5. **Communication**: All communication shall occur through OurFamilyWizard (or similar app) except in emergencies.

This Agreement is in the best interests of the children and may be incorporated into any final court order.

**IN WITNESS WHEREOF**, the parties execute this Agreement.
  `.trim(),
        hasAttorneySignature: false, // both parties sign + notary recommended
    },

    "agreed-order-custody-visitation-support": {
        title: "AGREED ORDER – CUSTODY, VISITATION, AND CHILD SUPPORT",
        pages: 4,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**AGREED ORDER**

This matter came before the Court upon the agreement of the parties.

The parties having agreed and the Court finding it to be in the best interests of the minor children, it is hereby **ADJUDGED, ORDERED, AND DECREED** that:

1. **Custody**: The parties shall share **joint legal custody**. **Primary physical custody** is awarded to **${info.custodialParent || 'the Plaintiff/Mother'}**.

2. **Visitation**: The non-custodial parent shall have visitation as set forth in the Parenting Plan dated ${info.parentingPlanDate || '[Date]'}, which is attached and incorporated herein by reference.

3. **Child Support**: **${info.payor || 'Defendant/Father'}** shall pay **$${info.childSupportAmount || '1,350.00'}** per month to **${info.payee || 'Plaintiff/Mother'}** for the support and maintenance of the minor children, commencing on the first day of the month following entry of this Order, and continuing until each child reaches the age of 18 or graduates from high school (whichever occurs later, but not beyond age 19) pursuant to Va. Code § 20-124.2(C).

4. **Health Insurance & Medical Expenses**: ${info.payor || 'Defendant'} shall maintain health insurance for the children. Unreimbursed medical, dental, and vision expenses shall be divided ${info.medSplit || '50/50'}.

This Order is entered by agreement of the parties and may be modified only upon a showing of material change in circumstances.

Entered this ___ day of __________, 20__.

___________________________  
Judge

We agree to the entry of the foregoing Order:

___________________________          ___________________________  
Plaintiff/Mother                         Defendant/Father
  `.trim(),
        hasAttorneySignature: false, // parties + attorneys endorse
    },

    "final-decree-of-divorce-with-children": {
        title: "FINAL DECREE OF DIVORCE (with children)",
        pages: 5,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
This cause came on to be heard upon the Complaint for Divorce, the Answer, evidence presented, and the agreement of the parties.

The Court, having considered the best interests of the minor children (§ 20-124.3), finds that it has jurisdiction and that the grounds for divorce have been proven.

**IT IS THEREFORE ADJUDGED, ORDERED, AND DECREED** that:

1. A divorce **a vinculo matrimonii** is granted to the Plaintiff from the Defendant pursuant to § 20-91(A)(9)(a).

2. **Custody & Visitation**: Joint legal custody is awarded to both parties. Primary physical custody is awarded to **${info.custodialParent || 'Plaintiff'}**. Visitation shall be as set forth in the Parenting Plan incorporated herein.

3. **Child Support**: **${info.payor || 'Defendant'}** shall pay child support to **${info.payee || 'Plaintiff'}** in the amount of **$${info.childSupportAmount || '1,350.00'}** per month pursuant to the Virginia guidelines (§ 20-108.2). Payments continue until each child reaches age 18 or graduates from high school (not beyond age 19).

4. **Health Insurance**: ${info.payor || 'Defendant'} shall maintain health insurance for the children. Uninsured medical expenses shall be divided ${info.medSplit || '50/50'}.

5. The Marital Settlement Agreement dated ${info.agreementDate || '[Date]'} is ratified, affirmed, and incorporated by reference (but not merged).

**NOTICE**: Child support is subject to modification upon a material change in circumstances. Beneficiary designations on life insurance and retirement accounts are governed by § 20-111.1.

Entered this ___ day of __________, 20__.

___________________________  
Judge
  `.trim(),
        hasAttorneySignature: false,
    },

    "motion-to-modify-custody-support": {
        title: "MOTION TO MODIFY CUSTODY, VISITATION, AND/OR CHILD SUPPORT",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**COMES NOW** **${info.movant || info.plaintiff}**, and moves this Court to modify the existing Order entered on ${info.previousOrderDate || '[date]'} on the following grounds:

There has been a **material change in circumstances** since the entry of the last Order, to-wit:  
${info.materialChange || '• Significant increase/decrease in income\n• Change in child’s needs\n• Relocation of a party'}.

Modification of custody, visitation, and/or child support is in the best interests of the child(ren).

**WHEREFORE**, the Movant prays that this Court modify custody/visitation and/or recalculate child support pursuant to the Virginia guidelines and award attorney’s fees and costs.
  `.trim(),
        hasAttorneySignature: true,
    },
    "petition-for-protective-order-family-abuse": {
        title: "PETITION FOR PROTECTIVE ORDER (Family Abuse)",
        pages: 3,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**PETITION FOR PROTECTIVE ORDER**

COMMONWEALTH OF VIRGINIA  
**JUVENILE AND DOMESTIC RELATIONS DISTRICT COURT**  
CITY OF NEWPORT NEWS

**${info.petitioner || 'Petitioner'}**  
v.  
**${info.respondent || 'Respondent'}**

The undersigned Petitioner, **${info.petitioner}**, being duly sworn, respectfully represents:

1. Petitioner and Respondent are **family or household members** as defined by Va. Code § 16.1-228:  
${info.relationship || 'spouse / former spouse / cohabitants / persons with a child in common'}.

2. Respondent has committed an act(s) of **family abuse** (Va. Code § 16.1-228) within a reasonable time, specifically:  
${info.abuseDetails || '• On or about [Date], Respondent struck Petitioner causing visible injury.\n• Respondent has repeatedly threatened to kill Petitioner and has access to firearms.\n• See attached detailed Affidavit for full facts.'}

3. Petitioner has reasonable fear of further harm to self and/or the following family/household members:  
${info.protectedPersons || 'Petitioner and minor child(ren): ' + (info.childrenList || '[names & DOBs]')}.

4. [ ] Petitioner requests an **ex parte Preliminary Protective Order** immediately.  
[ ] Petitioner requests a full hearing on a **Protective Order**.

**WHEREFORE**, Petitioner prays that the Court:  
a. Issue a **Preliminary Protective Order** (Va. Code § 16.1-253.1) and set this matter for full hearing within 15 days;  
b. Issue a **Protective Order** (Va. Code § 16.1-279.1) for up to two (2) years prohibiting acts of violence, contact, harassment, and granting exclusive possession of the residence at ${info.residence || '[address]'}, temporary custody/visitation, child support, and any other relief necessary for the protection of Petitioner and family/household members;  
c. Prohibit Respondent from possessing firearms (Va. Code § 18.2-308.1:4); and  
d. Grant such other and further relief as the Court deems just.

**${info.petitioner}**  
Petitioner  

Subscribed and sworn to before me this ___ day of __________, 20___.  

___________________________  
[Clerk / Notary / Intake Officer]  
My commission expires: __________
  `.trim(),
        hasAttorneySignature: false, // usually signed by petitioner + notary/intake
    },

    "emergency-protective-order-affidavit": {
        title: "AFFIDAVIT / REQUEST FOR EMERGENCY PROTECTIVE ORDER",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**AFFIDAVIT IN SUPPORT OF EMERGENCY PROTECTIVE ORDER**

COMMONWEALTH OF VIRGINIA  
CITY OF NEWPORT NEWS, to-wit:

I, **${info.petitioner}**, being first duly sworn, depose and state:

1. I am the victim of family abuse by **${info.respondent}**, a family/household member.

2. On or about **${info.incidentDate || '[recent date/time]'}**, the following act(s) occurred:  
${info.incidentDetails || 'Respondent physically assaulted me by punching me in the face and threatening to kill me if I left the house.'}

3. I am in immediate fear for my safety and the safety of ${info.protectedPersons || 'myself and my children'}. Respondent has access to firearms and has made credible threats.

4. This is an emergency because the courts are closed / Respondent is likely to harm me before a regular petition can be heard.

I respectfully request that the Magistrate issue an **Emergency Protective Order** (Va. Code § 19.2-152.8 or § 16.1-253.4) prohibiting contact, requiring Respondent to stay away from my residence at ${info.residence || '[full address]'}, and any other necessary relief.

Further affiant saith not.

___________________________  
${info.petitioner}

Subscribed and sworn to before me this ___ day of __________, 20___.  

___________________________  
Magistrate / Notary Public
  `.trim(),
        hasAttorneySignature: false,
    },

    "preliminary-protective-order": {
        title: "PRELIMINARY PROTECTIVE ORDER (Ex Parte)",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**PRELIMINARY PROTECTIVE ORDER**

COMMONWEALTH OF VIRGINIA  
JUVENILE AND DOMESTIC RELATIONS DISTRICT COURT  
CITY OF NEWPORT NEWS

Upon consideration of the Petition and Affidavit of **${info.petitioner}**, the Court finds probable cause that family abuse has occurred and that the Petitioner and protected persons are in reasonable fear of further harm.

**IT IS THEREFORE ORDERED** that:

1. **${info.respondent}** is enjoined from committing further acts of family abuse, violence, force, or threat against Petitioner or protected persons listed below.

2. **${info.respondent}** shall have no contact whatsoever with:  
**${info.petitioner}** and ${info.protectedPersons || 'the minor child(ren)'}.

3. **${info.respondent}** shall immediately vacate the residence at ${info.residence || '[address]'} and shall not return except to retrieve personal belongings with law enforcement escort.

4. Temporary custody of the minor children is awarded to Petitioner pending further hearing.

5. This Order is effective immediately upon service and shall remain in effect until **${info.expiration || 'the date and time of the full hearing'}** (no longer than 15 days).

Violation of this Order is a Class 1 misdemeanor and may result in arrest.

Entered this ___ day of __________, 20___.  

___________________________  
Judge / Magistrate
  `.trim(),
        hasAttorneySignature: false,
    },

    "full-protective-order-family-abuse": {
        title: "PROTECTIVE ORDER (Family Abuse)",
        pages: 3,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**PROTECTIVE ORDER**

COMMONWEALTH OF VIRGINIA  
JUVENILE AND DOMESTIC RELATIONS DISTRICT COURT  
CITY OF NEWPORT NEWS

This matter came before the Court upon the Petition of **${info.petitioner}**. After hearing the evidence, the Court finds by a preponderance of the evidence that family abuse has occurred.

**IT IS HEREBY ORDERED** that:

1. **${info.respondent}** is prohibited from committing acts of family abuse, violence, force, or threat against Petitioner or protected persons.

2. **${info.respondent}** shall have **no contact** of any kind (in person, telephone, text, email, social media, or third-party) with:  
**${info.petitioner}** and ${info.protectedPersons || '[list children & others]'}.

3. **${info.respondent}** is prohibited from coming within 500 feet of Petitioner’s residence, workplace, or the children’s school/daycare.

4. Petitioner is granted exclusive possession and use of the marital residence located at ${info.residence || '[address]'}.

5. Temporary legal and physical custody of the minor children is awarded to Petitioner. Visitation, if any, shall be supervised or as further ordered.

6. **${info.respondent}** shall pay temporary child support in the amount of **$${info.childSupport || 'TBD per guidelines'}** per month.

7. Respondent shall surrender all firearms and ammunition to law enforcement within 24 hours.

This Order shall remain in full force and effect for **two (2) years** from the date of entry (or until __________, 20___).

Violation of this Order is a Class 1 misdemeanor (and possible felony on repeat) and may result in immediate arrest. Firearm possession is prohibited under federal and state law.

Entered this ___ day of __________, 20___.  

___________________________  
Judge
  `.trim(),
        hasAttorneySignature: false,
    },

    "motion-for-protective-order-pendente-lite-divorce": {
        title: "MOTION FOR PROTECTIVE ORDER PENDENTE LITE (In Divorce Proceeding)",
        pages: 2,
        font: StandardFonts.TimesRoman,
        fontSize: 12,
        lineHeight: 24,
        spacingMultiplier: 1,
        captionStyle: "full" as const,
        body: (info: any) => `
**MOTION FOR PROTECTIVE ORDER PENDENTE LITE**

COMMONWEALTH OF VIRGINIA  
CIRCUIT COURT FOR THE CITY OF NEWPORT NEWS

**${info.plaintiff}**, Plaintiff,  
v.  
**${info.defendant}**, Defendant.

**COMES NOW** the Plaintiff, **${info.plaintiff}**, by counsel, and pursuant to Va. Code § 20-103 moves this Court for a **Protective Order pendente lite** as follows:

1. Defendant has committed acts of family abuse as detailed in the attached Affidavit.

2. Plaintiff and the minor children are in reasonable fear of further harm.

**WHEREFORE**, Plaintiff prays that the Court enter a Protective Order prohibiting contact, granting exclusive use of the marital residence, temporary custody, and any other relief necessary for the safety of Plaintiff and the children pending final divorce.

A hearing on this Motion is requested on an expedited basis.

___________________________  
Plaintiff / Attorney for Plaintiff
  `.trim(),
        hasAttorneySignature: true,
    }

};