import { MutableRefObject } from "react";
import { Crepe } from "@milkdown/crepe";

interface CustomButtonProps {
    crepeRef: MutableRefObject<Crepe | null>;
    label: string;
    action: (crepe: Crepe) => void;
}

const CustomButton: React.FC<CustomButtonProps> = ({ crepeRef, label, action }) => {
    const handleClick = () => {
        const crepe = crepeRef.current;
        if (crepe) {
            action(crepe);
        }
    };

    return (
        <button
      className= "custom-button px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    onClick = { handleClick }
        >
        { label }
        </button>
  );
};

export default CustomButton;
