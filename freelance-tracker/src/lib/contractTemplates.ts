export interface ContractTemplate {
  name: string;
  title: string;
  content: string;
}

export function getDefaultTemplate(): ContractTemplate {
  return {
    name: 'Freelance Service Agreement',
    title: 'Freelance Service Agreement',
    content: `FREELANCE SERVICE AGREEMENT

This agreement is entered into on {{date}} between:

FREELANCER (Service Provider):
{{freelancer_name}}
{{freelancer_address}}

CLIENT:
{{client_name}}
{{client_company}}

1. SCOPE OF WORK
{{scope}}

2. PAYMENT TERMS
{{payment_terms}}

3. TIMELINE
The work shall commence on the agreed start date and be completed as outlined in the project scope.

4. INTELLECTUAL PROPERTY
Upon full payment, all deliverables and intellectual property rights shall transfer to the Client.

5. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of any proprietary information shared during the course of this engagement.

6. REVISIONS
The scope includes up to two (2) rounds of revisions. Additional revisions may be subject to extra charges.

7. TERMINATION
Either party may terminate this agreement with 14 days written notice. The Client shall pay for all work completed up to the termination date.

8. LIABILITY
The Freelancer's liability shall be limited to the total fees paid under this agreement.

9. GOVERNING LAW
This agreement shall be governed by the laws of the applicable jurisdiction.

By signing below, both parties agree to the terms outlined in this agreement.`
  };
}

export function fillTemplate(content: string, data: Record<string, string>): string {
  let filled = content;
  for (const [key, value] of Object.entries(data)) {
    filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
  }
  return filled;
}
