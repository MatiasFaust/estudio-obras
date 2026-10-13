"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, List, ListOrdered, Quote, Strikethrough, Heading3 } from "lucide-react";
import { Fragment } from "react";
import type { RichText } from "@/lib/types";
import { cn } from "@/lib/utils";

const extensions = [
  StarterKit.configure({
    heading: { levels: [3] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
    underline: false,
  }),
  Placeholder.configure({ placeholder: "Escribí la nota…" }),
];

export interface RichTextValue {
  json: RichText;
  text: string;
}

/** Editor sencillo con formato básico */
export function RichTextEditor({
  initial,
  onChange,
  className,
}: {
  initial?: RichText | null;
  onChange: (value: RichTextValue) => void;
  className?: string;
}) {
  const editor = useEditor({
    extensions,
    content: initial && Object.keys(initial).length ? initial : "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "px-3 py-2 text-sm", "aria-label": "Texto de la nota" } },
    onUpdate: ({ editor }) => onChange({ json: editor.getJSON() as RichText, text: editor.getText({ blockSeparator: "\n" }) }),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            h3: editor.isActive("heading", { level: 3 }),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
          }
        : null,
  });

  const buttons = editor && state
    ? [
        { icon: Bold, label: "Negrita", active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
        { icon: Italic, label: "Cursiva", active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
        { icon: Strikethrough, label: "Tachado", active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
        { icon: Heading3, label: "Subtítulo", active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
        { icon: List, label: "Lista", active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
        { icon: ListOrdered, label: "Lista numerada", active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
        { icon: Quote, label: "Cita", active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
      ]
    : [];

  return (
    <div className={cn("rich-text rounded-lg border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30", className)}>
      <div className="flex flex-wrap gap-0.5 border-b p-1" role="toolbar" aria-label="Formato">
        {buttons.map(({ icon: Icon, label, active, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            // No quitar el foco del editor al aplicar formato
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className={cn(
              "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// ---- Visor: convierte el JSON de Tiptap en elementos React (sin HTML crudo) ----

interface Node {
  type: string;
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
  content?: Node[];
}

function renderText(node: Node, key: number) {
  let el: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong>{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "strike") el = <s>{el}</s>;
  }
  return <Fragment key={key}>{el}</Fragment>;
}

function renderNode(node: Node, key: number): React.ReactNode {
  const children = node.content?.map((c, i) => renderNode(c, i));
  switch (node.type) {
    case "doc": return <Fragment key={key}>{children}</Fragment>;
    case "text": return renderText(node, key);
    case "paragraph": return <p key={key}>{children}</p>;
    case "heading": return <h3 key={key}>{children}</h3>;
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak": return <br key={key} />;
    default: return <Fragment key={key}>{children}</Fragment>;
  }
}

export function RichTextView({ value, fallback, className }: { value: RichText; fallback?: string; className?: string }) {
  const doc = value as unknown as Node;
  if (!doc || !doc.type) return <p className={cn("rich-text whitespace-pre-wrap", className)}>{fallback}</p>;
  return <div className={cn("rich-text", className)}>{renderNode(doc, 0)}</div>;
}
