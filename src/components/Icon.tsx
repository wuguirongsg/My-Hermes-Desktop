import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "book"
  | "bot"
  | "brain"
  | "check"
  | "chevronRight"
  | "close"
  | "columns"
  | "command"
  | "copy"
  | "code"
  | "dashboard"
  | "edit"
  | "flag"
  | "graduation"
  | "keyboard"
  | "message"
  | "mic"
  | "package"
  | "palette"
  | "paperclip"
  | "refresh"
  | "scissors"
  | "search"
  | "send"
  | "settings"
  | "spark"
  | "terminal"
  | "timer"
  | "tool"
  | "volume";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, JSX.Element> = {
  alert: (
    <>
      <path d="M12 4.4 3.8 18.6a1.4 1.4 0 0 0 1.2 2.1h14a1.4 1.4 0 0 0 1.2-2.1L12 4.4Z" />
      <path d="M12 9v4.5" />
      <path d="M12 17.2h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v16H7a2.5 2.5 0 0 0-2.5 2.5v-16Z" />
      <path d="M4.5 5.5v16" />
      <path d="M8 7h7" />
      <path d="M8 10h5" />
    </>
  ),
  bot: (
    <>
      <rect x="5" y="7" width="14" height="11" rx="3" />
      <path d="M12 7V4" />
      <path d="M9 4h6" />
      <path d="M9.2 12h.01" />
      <path d="M14.8 12h.01" />
      <path d="M9.5 15h5" />
    </>
  ),
  brain: (
    <>
      <path d="M9.5 4.5a3 3 0 0 0-3 3v.3A3.4 3.4 0 0 0 4 11.1c0 1 .4 1.9 1.1 2.5A3.7 3.7 0 0 0 8.8 18h.7" />
      <path d="M14.5 4.5a3 3 0 0 1 3 3v.3a3.4 3.4 0 0 1 2.5 3.3c0 1-.4 1.9-1.1 2.5A3.7 3.7 0 0 1 15.2 18h-.7" />
      <path d="M12 5v14" />
      <path d="M8.2 9.2c.9-.3 1.9 0 2.4.8" />
      <path d="M15.8 9.2c-.9-.3-1.9 0-2.4.8" />
      <path d="M8.4 14.2c.9.5 1.9.5 2.8-.1" />
      <path d="M15.6 14.2c-.9.5-1.9.5-2.8-.1" />
    </>
  ),
  check: <path d="m5 12.5 4 4L19 6.5" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  columns: (
    <>
      <rect x="3.5" y="4" width="7" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="7" height="16" rx="1.5" />
      <path d="M10.5 8h3" />
      <path d="M10.5 16h3" />
    </>
  ),
  command: (
    <>
      <path d="M9 9H7.5A2.5 2.5 0 1 1 10 6.5V18a2.5 2.5 0 1 1-2.5-2.5H18" />
      <path d="M15 9h1.5A2.5 2.5 0 1 0 14 6.5V18a2.5 2.5 0 1 0 2.5-2.5H6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </>
  ),
  code: (
    <>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 5-4 14" />
    </>
  ),
  dashboard: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5.5h10.5l-.8 3 3.3 2.2H5" />
    </>
  ),
  graduation: (
    <>
      <path d="m3 8.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 10.5v4.2c1.3 1.4 3 2.1 5 2.1s3.7-.7 5-2.1v-4.2" />
      <path d="M21 9v5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01" />
      <path d="M7 14h10" />
    </>
  ),
  message: (
    <>
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4.2a3.5 3.5 0 0 1-3.5 3.5H11l-5.2 4.3v-4.4A3.5 3.5 0 0 1 5 10.7V6.5Z" />
      <path d="M9 8.2h6" />
      <path d="M9 11.2h3.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4.4 7.7 12 12l7.6-4.3" />
      <path d="M12 12v8.6" />
    </>
  ),
  paperclip: (
    <>
      <path d="M21.4 11.6 12.2 20.8a5.5 5.5 0 0 1-7.8-7.8L14.6 2.8a3.5 3.5 0 0 1 5 5L9.3 18a1.5 1.5 0 0 1-2.1-2.1l9.3-9.4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17h1.2a1.8 1.8 0 0 0 1.2-3.1 1.8 1.8 0 0 1 1.2-3.1H17a4.5 4.5 0 0 0 4.5-4.5c0-3.5-3.5-6.3-9.5-6.3Z" />
      <path d="M7.5 11h.01" />
      <path d="M9.5 7.8h.01" />
      <path d="M14 7.5h.01" />
      <path d="M16.5 10.5h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18.4 10A6.5 6.5 0 0 0 7 6.6L4 9.5" />
      <path d="M5.6 14A6.5 6.5 0 0 0 17 17.4l3-2.9" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8.2 8.2 19 19" />
      <path d="M8.2 15.8 19 5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4 18-7Z" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1a2.1 2.1 0 0 1-3 3l-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6V21a2.1 2.1 0 0 1-4.2 0v-.2a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.1H2a2.1 2.1 0 0 1 0-4.2h.2a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.4-2l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.6V2a2.1 2.1 0 0 1 4.2 0v.2a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1.1h.2a2.1 2.1 0 0 1 0 4.2H21a1.8 1.8 0 0 0-1.6 1.3Z" />
    </>
  ),
  spark: (
    <>
      <path d="M13.5 2.8 6.5 13H12l-1.5 8.2 7-10.2H12l1.5-8.2Z" />
      <path d="M4.8 5.2 3.5 7.8" />
      <path d="M20.5 16.2l-1.3 2.6" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M12.5 15h4.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 13V9" />
      <path d="M12 13l3 2" />
      <path d="M9 2h6" />
    </>
  ),
  tool: (
    <>
      <path d="M14.7 6.3a4.2 4.2 0 0 0 4.7 5.5l-7.6 7.6a2.3 2.3 0 0 1-3.2-3.2l7.6-7.6a4.2 4.2 0 0 0-1.5-2.3Z" />
      <path d="m6.5 17.5 2 2" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
};

export default function Icon({ name, size = 16, className = "", ...props }: IconProps) {
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
