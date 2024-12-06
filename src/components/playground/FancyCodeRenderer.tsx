import React from "react";

interface FancyCodeRendererProps {
    code: string;
    language: string;
    filePath?: string;
}

const FancyCodeRenderer: FC<FancyCodeRendererProps> = ({
    code,
    language,
    filePath = "Unknown File",
}) => (
    <div className="fancy-code-renderer border rounded bg-gray-900 text-white p-4">
        <div className="file-path text-sm mb-2 text-gray-400">{filePath}</div>
        <pre className={`language-${language}`}>
            <code>{code}</code>
        </pre>
    </div>
);

export default FancyCodeRenderer;
