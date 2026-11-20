export const MAX_SMS_LENGTH = 612;

/** Ready-made texts for common recruitment situations, shown in the template picker so nobody starts from a blank box. */
export const STARTER_TEMPLATES: { id: string; name: string; body: string }[] = [
  { id: 'new-vacancy', name: 'New vacancy', body: 'Hi {{firstName}}, we have a new {{jobTitle}} vacancy that may suit you. Reply YES for details or call us. {{recruiterName}}. Reply STOP to opt out.' },
  { id: 'availability', name: 'Are you available?', body: 'Hi {{firstName}}, are you currently available for work? Reply YES or NO and we will be in touch. {{recruiterName}}. Reply STOP to opt out.' },
  { id: 'interview', name: 'Interview invitation', body: 'Hi {{firstName}}, we would like to invite you to an interview for the {{jobTitle}} role. Please reply with a time that suits you. {{recruiterName}}' },
  { id: 'documents', name: 'Documents request', body: 'Hi {{firstName}}, please send us your up-to-date CV, right-to-work document and any tickets or cards (e.g. CSCS) for the {{jobTitle}} role. Thank you, {{recruiterName}}' },
  { id: 'shift', name: 'Start / shift reminder', body: 'Hi {{firstName}}, a reminder about your start on the {{jobTitle}} job. Please reply to confirm you can make it. {{recruiterName}}' },
  { id: 'thanks', name: 'Thanks, not this time', body: 'Hi {{firstName}}, thank you for applying for the {{jobTitle}} role. We will not be taking it further this time but will keep your details for future vacancies. {{recruiterName}}. Reply STOP to opt out.' },
];
