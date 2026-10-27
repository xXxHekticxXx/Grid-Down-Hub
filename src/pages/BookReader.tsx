// Native chapters of ATP 3-50.21 and FEMA P-2064: full text, every figure and table.
import { useEffect, useState } from 'react';
import { Screen, Row, Btn } from '../ui/ui';
import { content, type BookMeta } from '../lib/content';
import type { Book, BookBlock, BookChapter } from '../types';
import { href } from '../lib/router';

const cache = new Map<string, Promise<Book>>();
function loadBook(id: string) {
  if (!cache.has(id)) cache.set(id, fetch(`${import.meta.env.BASE_URL}books/${id}/book.json`).then((r) => r.json()));
  return cache.get(id)!;
}

function Block({ b, bookId, i }: { b: BookBlock; bookId: string; i: number }) {
  const id = `blk-${i}`;
  switch (b.t) {
    case 'h2': return <h2 id={id} style={{ margin: '22px 0 8px', fontSize: 'calc(var(--fs)*1.4)' }}>{b.text}</h2>;
    case 'h3': return <h3 id={id} style={{ margin: '16px 0 6px' }}>{b.text}</h3>;
    case 'h4': return <h4 id={id} style={{ margin: '12px 0 4px' }}>{b.text}</h4>;
    case 'li': return <ul id={id} style={{ margin: '0 0 6px', paddingLeft: '1.3em' }}><li>{b.text}</li></ul>;
    case 'warn': return <div id={id} className="book-warn"><b>{b.label}:</b> {b.text}</div>;
    case 'fig':
    case 'table':
      return (
        <figure id={id} className="figure">
          <img src={`${import.meta.env.BASE_URL}books/${bookId}/${b.src}`} width={b.w} height={b.h} alt={b.caption || (b.t === 'table' ? 'Table' : 'Figure') + ` on page ${b.page}`} loading="lazy" />
          {b.caption && <figcaption>{b.caption}</figcaption>}
          {b.t === 'table' && <details><summary className="small">Table text</summary><p className="small">{b.text}</p></details>}
        </figure>
      );
    default:
      return <p id={id} className="book-block">{b.num && <span className="book-num">{b.num}.</span>}{b.text}</p>;
  }
}

export default function BookReader({ bookId, chapterId, block }: { bookId: string; chapterId?: string; block?: string | null }) {
  const [meta, setMeta] = useState<BookMeta | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  useEffect(() => {
    content().then((c) => setMeta(c.books.find((b) => b.id === bookId) ?? null));
    loadBook(bookId).then(setBook);
  }, [bookId]);
  useEffect(() => {
    if (book && block) setTimeout(() => document.getElementById(`blk-${block}`)?.scrollIntoView({ block: 'start' }), 60);
  }, [book, block, chapterId]);
  if (!meta || !book) return <Screen title="Library">{<p className="muted">Opening…</p>}</Screen>;
  const ch: BookChapter | undefined = book.chapters.find((c) => c.id === chapterId);
  if (!ch) {
    return (
      <Screen title={meta.short} crumb="Library">
        <h2 style={{ marginBottom: 6 }}>{meta.title}</h2>
        <p className="small muted">{meta.publisher}, {meta.year}</p>
        <div className="book-notice">{meta.notice}</div>
        <div className="list">
          {book.chapters.map((c) => <Row key={c.id} to={`/book/${bookId}/${c.id}`} title={c.title} sub={`Pages ${c.pageStart}–${c.pageEnd} · ${c.blocks.filter((b) => b.t === 'fig' || b.t === 'table').length} figures and tables`} />)}
        </div>
        <div className="btnrow" style={{ marginTop: 12 }}><Btn icon="file" to={`/pdf/${meta.libraryId}`}>Open the original PDF</Btn></div>
      </Screen>
    );
  }
  const idx = book.chapters.indexOf(ch);
  const prev = book.chapters[idx - 1];
  const next = book.chapters[idx + 1];
  return (
    <Screen title={ch.title} crumb={meta.short}>
      {/medicine/i.test(ch.title) && <div className="book-notice">{meta.notice}</div>}
      <article style={{ maxWidth: 780 }}>
        {ch.blocks.map((b, i) => <Block key={i} b={b} bookId={bookId} i={i} />)}
      </article>
      <div className="btnrow" style={{ marginTop: 16 }}>
        {prev && <Btn icon="back" to={`/book/${bookId}/${prev.id}`}>{prev.title}</Btn>}
        {next && <Btn to={`/book/${bookId}/${next.id}`}>{next.title} ›</Btn>}
      </div>
      <p className="small"><a href={href(`/pdf/${meta.libraryId}?page=${ch.pageStart}`)}>Same pages in the original PDF</a> · <a href={href(`/book/${bookId}`)}>All chapters</a></p>
    </Screen>
  );
}
