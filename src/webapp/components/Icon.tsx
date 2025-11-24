// Icon component with custom SVG icons
interface IconFrameProps {
  size?: number;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const IconFrame = ({ size = 18, className, children, ...rest }: IconFrameProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

// Home icon
export const HomeIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </IconFrame>
);

// Profile/User icon
export const ProfileIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </IconFrame>
);

// Settings icon
export const SettingsIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
  </IconFrame>
);

// Compose/Edit icon (pen)
export const ComposeIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </IconFrame>
);

// Existing icons (keeping for compatibility)
export const SparklesIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="m12 3 1.5 4.8 4.8 1.5-4.8 1.5L12 16.5l-1.5-5.7L5.8 9.3l4.7-1.5L12 3Z" />
    <path d="m5 4.5.7 2.1 2.1.7-2.1.7L5 10.1l-.7-2.1L2.2 7.3l2.1-.7L5 4.5Z" />
    <path d="m19 15.9.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z" />
  </IconFrame>
);

export const PulseIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M3 13h2l2-6 4 12 3-9 1.5 3H21" />
  </IconFrame>
);

export const CompassIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.5 9.5 7-2.5-2.5 7-7 2.5 2.5-7Z" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </IconFrame>
);

export const PenIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="m4 20 3-.6 11-11-3.4-3.4-11 11L3 21l1-1Z" />
    <path d="m15.5 5.5 3 3" />
  </IconFrame>
);

export const SearchIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </IconFrame>
);

export const FlameIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M12 3c-2 3 1 4.6 1 7 0 1.7-1.1 3-2.7 3.9C8.7 14.8 8 16.3 8 18a4 4 0 0 0 8 0c0-1.8-.5-2.9-1.1-3.9-.5-1 1.8-2 1.8-4.7 0-2.1-1-3.7-2.7-6.4Z" />
  </IconFrame>
);

export const HashIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M9 4 7 20" />
    <path d="M17 4 15 20" />
    <path d="M4 9h16" />
    <path d="M3 15h16" />
  </IconFrame>
);

export const ReplyIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M10 7.5V4L3 11l7 7v-3.5c6.5 0 10 2.5 11 6-1-7-5-11-11-11Z" />
  </IconFrame>
);

export const RepeatIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M15 5h-7a4 4 0 0 0 0 8h9" />
    <path d="m11 19 3-3-3-3" />
    <path d="m13 5 3 3-3 3" />
    <path d="M9 19h7a4 4 0 0 0 0-8H7" />
  </IconFrame>
);

export const SlidersIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M6 4v16" />
    <path d="M12 4v16" />
    <path d="M18 4v16" />
    <circle cx="6" cy="9" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="11" r="2.2" fill="currentColor" stroke="none" />
  </IconFrame>
);

export const UserPlusIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M4 20a5 5 0 0 1 10 0" />
    <path d="M17 8v6" />
    <path d="M14 11h6" />
  </IconFrame>
);

export const ImageIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.2" />
    <path d="m7 14 3-3 4 5 3-4 3 4" />
    <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
  </IconFrame>
);

export const ChartIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M5 20V10" />
    <path d="M12 20V4" />
    <path d="M19 20v-8" />
  </IconFrame>
);

export const ShieldIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M12 3 5 6v5c0 4.5 2.6 8.3 7 9.9 4.4-1.6 7-5.4 7-9.9V6l-7-3Z" />
    <path d="M9.5 12.5 11 14l3.5-4.5" />
  </IconFrame>
);

// Emoji/Smiley icon
export const EmojiIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <path d="M8 14c1.5 2 4.5 2 6 0" strokeLinecap="round" />
  </IconFrame>
);

// Calendar icon
export const CalendarIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </IconFrame>
);

// Bookmark icon
export const BookmarkIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </IconFrame>
);

// Bookmark icon (filled)
export const BookmarkFilledIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor" />
  </IconFrame>
);

// Trash/Delete icon
export const TrashIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </IconFrame>
);

// Messages/Envelope icon
export const MessagesIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <path d="m22 6-10 7L2 6" />
  </IconFrame>
);

// Forums/Discussion icon (two speech bubbles)
export const ForumsIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M13 8H3" />
    <path d="M17 12H3" />
  </IconFrame>
);

// Friends/Users icon
export const FriendsIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </IconFrame>
);

// Media/Image icon (using existing ImageIcon)
export const MediaIcon = ImageIcon;

// Newspaper icon (for News Feed)
export const NewspaperIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
    <path d="M18 14h-8" />
    <path d="M15 18h-5" />
    <path d="M10 6h8v4h-8V6Z" />
  </IconFrame>
);

// Bell/Notification icon
export const BellIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </IconFrame>
);

// Shield/Integrity icon
export const ShieldCheckIcon = (props: Omit<IconFrameProps, 'children'>) => (
  <IconFrame {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </IconFrame>
);

