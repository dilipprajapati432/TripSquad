import { initials } from "../lib/format.js";

export default function Avatar({ member, size = 32, online = false }) {
  if (!member) return null;
  return (
    <span
      className={`avatar ${online ? "avatar-online" : ""}`}
      style={{ width: size, height: size, background: member.color, fontSize: size * 0.4 }}
      title={member.name + (online ? " (online)" : "")}
    >
      {initials(member.name)}
    </span>
  );
}
