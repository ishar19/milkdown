import { useToast } from "@/components/toast";
import { useDarkMode } from "@/providers";
import { encode } from "@/utils/share";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx, parserCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Slice } from "@milkdown/kit/prose/model";
import { Selection } from "@milkdown/kit/prose/state";
import { getMarkdown } from "@milkdown/kit/utils";
import { eclipse } from "@uiw/codemirror-theme-eclipse";
import { useAtomValue, useSetAtom } from "jotai";
import throttle from "lodash.throttle";
import { FC, MutableRefObject, useLayoutEffect, useRef } from "react";
import { crepeAPI, markdown } from "./atom";
import CustomButton from "./CustomButton";
import FancyCodeRenderer from "./FancyCodeRenderer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Render custom components (like FancyEditor) inside markdown
const renderCustomComponents = (markdown: string) => {
  const customComponentRegex = /<FancyEditor\s*\/>/g;

  // Return transformed markdown with placeholder for FancyEditor
  return markdown.replace(customComponentRegex, () => {
    return "<FancyEditorComponent />";
  });
};

interface MilkdownProps {
  onChange: (markdown: string) => void;
}

const CrepeEditor: FC<MilkdownProps> = ({ onChange }) => {
  const crepeRef = useRef<Crepe>(null);
  const darkMode = useDarkMode();
  const divRef = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const toast = useToast();
  const content = useAtomValue(markdown);
  const setCrepeAPI = useSetAtom(crepeAPI);

  // Insert custom components (like FancyEditor) during markdown updates
  const insertBoldText = (crepe: Crepe) => {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      const { state, dispatch } = view;
      const schema = state.schema;

      // Find the bold mark in the schema
      const boldMark = schema.marks.strong;

      if (!boldMark) return;

      const { from, to, empty } = state.selection;

      if (empty) {
        // If no text is selected, insert bold text
        const tr = state.tr.insertText("Bold Text");
        dispatch(tr.addMark(from, from + 9, boldMark.create())); // Apply bold mark to the inserted text
      } else {
        // If text is selected, toggle bold formatting
        dispatch(state.tr.addMark(from, to, boldMark.create()));
      }

      toast("Inserted Bold Text", "success");
    });
  };



  const insertLink = (crepe: Crepe) => {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const schema = state.schema;

      // Create the link mark
      const linkMark = schema.marks.link;
      if (!linkMark) return;

      const { from, to, empty } = state.selection;

      if (empty) {
        // Insert default link text
        const tr = state.tr.insertText("Link Text");
        dispatch(
          tr.addMark(
            from,
            from + 9, // Length of "Link Text"
            linkMark.create({ href: "https://example.com" })
          )
        );
      } else {
        // Apply the link to the selected text
        dispatch(
          state.tr.addMark(from, to, linkMark.create({ href: "https://example.com" }))
        );
      }

      toast("Inserted Link", "success");
    });
  };


  const insertFancyCodeBlock = (crepe: Crepe) => {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const schema = state.schema;

      // Find the code block node in the schema
      const codeBlockNode = schema.nodes.code_block;
      if (!codeBlockNode) return;

      // Create a transaction to insert the code block
      const tr = state.tr.replaceSelectionWith(
        codeBlockNode.create({ language: "javascript" }, state.schema.text("// File: example.js\nconsole.log('Hello, Fancy Code!');"))
      );

      dispatch(tr);
      toast("Inserted Fancy Code Block", "success");
    });
  };

  useLayoutEffect(() => {
    if (!divRef.current || loading.current) return;

    loading.current = true;
    const crepe = new Crepe({
      root: divRef.current,
      defaultValue: content,
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          theme: darkMode ? undefined : eclipse,
        },
        [Crepe.Feature.LinkTooltip]: {
          onCopyLink: () => {
            toast("Link copied", "success");
          },
        },
      },
    });

    crepe.editor
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated(
          throttle((_, markdown) => {
            const transformedMarkdown = renderCustomComponents(markdown);
            onChange(transformedMarkdown);  // Pass transformed markdown
          }, 200)
        );
      })
      .use(listener);

    crepe.create().then(() => {
      (crepeRef as MutableRefObject<Crepe>).current = crepe;
      loading.current = false;
    });

    setCrepeAPI({
      loaded: true,
      onShare: () => {
        const content = crepe.editor.action(getMarkdown());
        const base64 = encode(content);

        const url = new URL(location.href);
        url.searchParams.set("text", base64);
        navigator.clipboard.writeText(url.toString()).then(() => {
          toast("Share link copied.", "success");
        });
        window.history.pushState({}, "", url.toString());
      },
      update: (markdown: string) => {
        const crepe = crepeRef.current;
        if (!crepe) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const parser = ctx.get(parserCtx);
          const doc = parser(markdown);
          if (!doc) return;
          const state = view.state;
          const selection = state.selection;
          const { from } = selection;
          let tr = state.tr;
          tr = tr.replace(
            0,
            state.doc.content.size,
            new Slice(doc.content, 0, 0)
          );
          tr = tr.setSelection(Selection.near(tr.doc.resolve(from)));
          view.dispatch(tr);
        });
      },
    });

    return () => {
      if (loading.current) return;
      crepe.destroy();
      setCrepeAPI({
        loaded: false,
        onShare: () => { },
        update: () => { },
      });
    };
  }, [content, darkMode, onChange, setCrepeAPI, toast]);

  // Render markdown content with React components
  const renderMarkdown = (markdown: string) => {
    const transformedMarkdown = renderCustomComponents(markdown);

    // Use ReactMarkdown to render custom components and markdown
    return (
      <ReactMarkdown
        children={transformedMarkdown}
        remarkPlugins={[remarkGfm]} // Enable GitHub-flavored markdown
        components={{
          FancyEditorComponent: () => <FancyCodeRenderer /> // Custom component for <FancyEditor />
        }}
      />
    );
  };

  return (
    <div className="overflow-y-scroll h-full flex flex-col">
      <div className=" flex gap-2 mb-4">
        <CustomButton crepeRef={crepeRef} label="Bold" action={insertBoldText} />
        <CustomButton crepeRef={crepeRef} label="Link" action={insertLink} />
        <CustomButton
          crepeRef={crepeRef}
          label="Fancy Code Block"
          action={insertFancyCodeBlock}
        />
      </div>
      <div className="crepe flex h-full flex-1 flex-col" ref={divRef} />
    </div>

    // <div className="editor-container flex flex-col h-full">

    /* <div className="markdown-preview">
      {renderMarkdown(content)} 
    </div> */
    // </div>
  );
};

export default CrepeEditor;
