/**
 * The TripSquad logo (public/wordmark.png). Dark mode swaps in a version with light text
 * (public/wordmark-dark.png) so the name stays readable on dark backgrounds.
 * Both images are 579×128; the width/height attributes reserve the space so nothing jumps while they load.
 */
export default function Wordmark({ height = 28 }) {
  const width = Math.round((height * 579) / 128);
  return (
    <>
      <img className="wordmark wordmark-light" src="/wordmark.png" alt="TripSquad" width={width} height={height} />
      <img className="wordmark wordmark-dark" src="/wordmark-dark.png" alt="TripSquad" width={width} height={height} />
    </>
  );
}
