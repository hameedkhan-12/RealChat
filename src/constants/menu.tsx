import React from 'react'
import CalIcon from '@/icons/cal-icon'
import ChatIcon from '@/icons/chat-icon'
import DashboardIcon from '@/icons/dashboard-icon'
import HelpDeskIcon from '@/icons/help-desk-icon'
import SettingsIcon from '@/icons/settings-icon'
import StarIcon from '@/icons/star-icon'
import TimerIcon from '@/icons/timer-icon'

type SIDE_BAR_MENU_PROPS = { label: string; icon: React.ReactNode; path: string }

export const SIDE_BAR_MENU: SIDE_BAR_MENU_PROPS[] = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: 'dashboard' },
  { label: 'Conversations', icon: <ChatIcon />, path: 'conversations' },
  { label: 'Settings', icon: <SettingsIcon />, path: 'settings' },
  { label: 'Appointments', icon: <CalIcon />, path: 'appointments' },
]

type TABS_MENU_PROPS = { label: string; icon?: React.ReactNode }

export const TABS_MENU: TABS_MENU_PROPS[] = [
  { label: 'unread' },
  { label: 'all' },
  { label: 'expired', icon: <TimerIcon /> },
  { label: 'starred', icon: <StarIcon /> },
]

export const HELP_DESK_TABS_MENU: TABS_MENU_PROPS[] = [{ label: 'help desk' }, { label: 'questions' }]
export const APPOINTMENT_TABLE_HEADER = ['Name', 'RequestedTime', 'Added Time', 'Domain']
export const EMAIL_MARKETING_HEADER = ['Id', 'Email', 'Answers', 'Domain']
export const BOT_TABS_MENU: TABS_MENU_PROPS[] = [{ label: 'chat', icon: <ChatIcon /> }, { label: 'helpdesk', icon: <HelpDeskIcon /> }]