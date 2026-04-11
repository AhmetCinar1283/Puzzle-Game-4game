import { Entity } from "../../logic/entityTypes";

export const BoxGraphic = ({ entity }: { entity: Entity }) => {
    return (
        <div className="w-16 h-16 bg-yellow-700 border-4 border-yellow-900 flex items-center justify-center text-2xl">
            📦
        </div>
    );
};