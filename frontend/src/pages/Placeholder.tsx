interface PlaceholderProps {
  titulo: string;
}

function Placeholder({ titulo }: PlaceholderProps) {
  return (
    <div>
      <h2>{titulo}</h2>
      <p style={{ color: "#8a8a8a" }}>Esta tela ainda está em construção.</p>
    </div>
  );
}

export default Placeholder;
