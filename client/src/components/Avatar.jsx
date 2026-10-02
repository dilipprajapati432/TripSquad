import { initials } from "../lib/format.js";

/** Round profile picture. Falls back to colored initials. Pass onClick to make it open a profile. */
export default function Avatar({ member, size = 32, online = false, onClick, title }) {
  if (!member) return null;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`avatar ${online ? "avatar-online" : ""} ${onClick ? "avatar-click" : ""}`}
      style={{ width: size, height: size, background: member.avatar ? "transparent" : member.color || "#64748b", fontSize: size * 0.4, padding: 0 }}
      title={title || member.name + (online ? " (online)" : "")}
      onClick={onClick}
    >
      {member.avatar ? <img src={member.avatar} alt={member.name} /> : initials(member.name)}
    </Tag>
  );
}
