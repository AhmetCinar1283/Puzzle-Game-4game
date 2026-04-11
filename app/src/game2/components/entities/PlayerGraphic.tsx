import { Entity } from "../../logic/entityTypes";

export const PlayerGraphic = ({ entity }: { entity: Entity}) => {
  // Belki oyuncunun yönüne göre resmi çevirirsin (sağa bak, sola bak)
  const rotateClass = entity.physics.direction === 'right' ? 'scale-x-1' : '-scale-x-1';

  return (
    <div className={`w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center ${rotateClass}`}>
      🤠
    </div>
  );
};