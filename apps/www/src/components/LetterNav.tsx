import "./LetterNav.css";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LetterNav() {
  return (
    <nav class="letter-nav">
      {LETTERS.map(letter => (
        <a href={`/letter/${letter.toLowerCase()}`} class="letter-nav-item">
          {letter}
        </a>
      ))}
    </nav>
  );
}
