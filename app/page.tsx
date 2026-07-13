import NoteEditor from "@/components/NoteEditor";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-3xl px-6 py-14 sm:px-10">
        <NoteEditor />
      </main>
    </div>
  );
}
