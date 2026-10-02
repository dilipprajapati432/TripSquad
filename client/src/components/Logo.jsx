// Brand mark: a route line between two stops inside a rounded square.
export default function Logo({ size = 26 }) {
  return (
    <img 
      src="/logo.png" 
      alt="TripSquad Logo" 
      width={size} 
      height={size} 
      className="logo-mark" 
    />
  );
}
