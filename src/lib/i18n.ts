export type Lang = 'en' | 'ar'

export type Strings = {
  welcome: string
  placeholder: string
  send: string
  live: string
  online: string
  helpDesk: string
  backToChat: string
  noHelpDesk: string
  uploadingImage: string
  connectLiveAgent: string
  connectLiveAgentShort: string
  thankYou: string
  bookACall: string
  talkToAPerson: string
  noThanks: string
  imageUploaded: string
  pleaseChooseOption: string
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    welcome: 'Hi! How can we help you today?',
    placeholder: "Type your message...",
    send: 'Send message',
    live: 'Live',
    online: 'Online',
    helpDesk: 'Help Desk',
    backToChat: 'Back to Chat',
    noHelpDesk: 'No help desk items configured.',
    uploadingImage: 'Attaching file...',
    connectLiveAgent: 'Talk to a person',
    connectLiveAgentShort: 'Person',
    thankYou: "Thank you! How would you like to proceed?",
    bookACall: 'Book a call',
    talkToAPerson: 'Talk to a person',
    noThanks: 'No thanks',
    imageUploaded: 'Image uploaded',
    pleaseChooseOption: 'Please choose an option',
  },
  ar: {
    welcome: 'مرحباً! كيف يمكننا مساعدتك اليوم؟',
    placeholder: 'اكتب رسالتك...',
    send: 'إرسال',
    live: 'مباشر',
    online: 'متصل',
    helpDesk: 'مركز المساعدة',
    backToChat: 'العودة للدردشة',
    noHelpDesk: 'لا توجد عناصر مركز مساعدة مconfigured.',
    uploadingImage: 'جاري إرفاق الملف...',
    connectLiveAgent: 'التحدث مع مسؤول',
    connectLiveAgentShort: 'مسؤول',
    thankYou: 'شكراً! كيف تود المتابعة؟',
    bookACall: 'حجز مكالمة',
    talkToAPerson: 'التحدث مع شخص',
    noThanks: 'لا شكراً',
    imageUploaded: 'تم رفع الصورة',
    pleaseChooseOption: 'الرجاء اختيار خيار',
  },
}

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang] || STRINGS.en
}
