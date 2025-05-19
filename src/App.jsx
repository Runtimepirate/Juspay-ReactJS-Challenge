import React, { useState, useRef, useEffect } from "react";
import "./index.css";

const emojis = ["😺", "🐶", "🦁", "🐘", "🦒", "🐻", "🐰", "🦊", "🐼", "🐨"];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pause = (ms) => new Promise((res) => setTimeout(res, ms));

function colorMap(type) {
  return {
    move: "#2563eb",
    turn: "#2563eb",
    goto: "#2563eb",
    repeat: "#f97316",
    say: "#7c3aed",
    think: "#7c3aed",
  }[type];
}

function label(t, p) {
  switch (t) {
    case "move":
      return `Move ${p.steps} steps`;
    case "turn":
      return `Turn ${p.deg}°`;
    case "goto":
      return `Go to x:${p.x} y:${p.y}`;
    case "repeat":
      return `Repeat ${p.times}×`;
    case "say":
      return `Say "${p.text}" for ${p.secs}s`;
    case "think":
      return `Think "${p.text}" for ${p.secs}s`;
    default:
      return "";
  }
}

export default function App() {
  const [sprites, setSprites] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const stageRef = useRef(null);

  // Add initial sprite on mount
  useEffect(() => {
    addSprite();
    // eslint-disable-next-line
  }, []);

  const current = sprites.find((s) => s.id === currentId) || null;

  function addSprite() {
    const id = `Sprite${sprites.length + 1}`;
    const sprite = {
      id,
      emoji: emojis[rand(0, emojis.length - 1)],
      color: `hsl(${rand(0, 360)},70%,55%)`,
      x: rand(30, 300),
      y: rand(30, 140),
      dir: 0,
      code: [],
    };
    setSprites((prev) => [...prev, sprite]);
    setCurrentId(id);

    // demo blocks only for first sprite
    if (sprites.length === 0) {
      sprite.code.push({ type: "move", params: { steps: 60 } });
      sprite.code.push({ type: "turn", params: { deg: 90 } });
      sprite.code.push({ type: "move", params: { steps: 40 } });
      sprite.code.push({ type: "say", params: { text: "Demo", secs: 2 } });
    }
  }

  function updateSprite(id, changes) {
    setSprites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...changes } : s))
    );
  }

  function promptParams(type) {
    switch (type) {
      case "move":
        return { steps: Number(prompt("Steps to move?", 10)) || 0 };
      case "turn":
        return { deg: Number(prompt("Degrees to turn?", 15)) || 0 };
      case "goto":
        return {
          x: Number(prompt("X coordinate?", 0)) || 0,
          y: Number(prompt("Y coordinate?", 0)) || 0,
        };
      case "repeat":
        return { times: Number(prompt("Repeat how many times?", 2)) || 1 };
      case "say":
        return {
          text: prompt("What to say?", "Hello") || "Hello",
          secs: Number(prompt("Duration (s)?", 2)) || 1,
        };
      case "think":
        return {
          text: prompt("What to think?", "Hmm") || "Hmm",
          secs: Number(prompt("Duration (s)?", 2)) || 1,
        };
      default:
        return null;
    }
  }

  function handleBlockDrop(e) {
    e.preventDefault();
    if (!current) return alertBox("Please select or add a sprite first");
    const type = e.dataTransfer.getData("text/plain");
    const params = promptParams(type);
    if (!params) return;
    current.code.push({ type, params });
    updateSprite(current.id, { code: current.code });
  }

  // Execution engine
  async function execute(sprite, block) {
    switch (block.type) {
      case "move": {
        const rad = (sprite.dir * Math.PI) / 180;
        sprite.x += block.params.steps * Math.cos(rad);
        sprite.y += block.params.steps * Math.sin(rad);
        break;
      }
      case "turn":
        sprite.dir = (sprite.dir + block.params.deg) % 360;
        break;
      case "goto":
        sprite.x = block.params.x;
        sprite.y = block.params.y;
        break;
      case "repeat": {
        const idx = sprite.code.indexOf(block) - 1;
        if (idx >= 0) {
          for (let i = 0; i < block.params.times; i++) {
            await execute(sprite, sprite.code[idx]);
          }
        }
        break;
      }
      case "say":
        await bubble(sprite, block.params.text, block.params.secs, false);
        break;
      case "think":
        await bubble(sprite, block.params.text, block.params.secs, true);
        break;
      default:
    }
    await pause(280);
  }

  function bubble(sprite, text, secs, isThought) {
    return new Promise((res) => {
      const stage = stageRef.current;
      if (!stage) return res();
      const div = document.createElement("div");
      div.className =
        "bubble absolute bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm shadow-lg";
      div.textContent = text;
      div.style.left = sprite.x + 56 + "px";
      div.style.top = sprite.y + "px";
      if (isThought) div.style.fontStyle = "italic";
      stage.appendChild(div);
      setTimeout(() => {
        stage.removeChild(div);
        res();
      }, secs * 1000);
    });
  }

  function overlap(a, b) {
    const r1 = a.getBoundingClientRect();
    const r2 = b.getBoundingClientRect();
    return !(
      r1.right < r2.left ||
      r1.left > r2.right ||
      r1.bottom < r2.top ||
      r1.top > r2.bottom
    );
  }

  function detectCollisions() {
    const nodes = stageRef.current?.querySelectorAll(".sprite") || [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (overlap(nodes[i], nodes[j])) {
          setSprites((prev) => {
            const copy = JSON.parse(JSON.stringify(prev));
            const a = copy[i];
            const b = copy[j];
            [a.code, b.code] = [b.code, a.code];
            return copy;
          });
          alertBox(`${sprites[i].id} & ${sprites[j].id} swapped animations!`);
        }
      }
    }
  }

  async function runAll() {
    for (const sp of sprites) {
      for (const block of sp.code) {
        await execute(sp, block);
        detectCollisions();
      }
      updateSprite(sp.id, sp); // Update positions after run
    }
  }

  function alertBox(msg) {
    const div = document.createElement("div");
    div.className =
      "fixed bottom-4 right-4 bg-rose-500 text-white px-4 py-2 rounded-md shadow-lg";
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2800);
  }

  /* ----- UI ----- */

  const toolboxBlocks = [
    { type: "move", label: "Move __ steps", color: "bg-blue-600" },
    { type: "turn", label: "Turn __°", color: "bg-blue-600" },
    { type: "goto", label: "Go to x:__ y:__", color: "bg-blue-600" },
    { type: "repeat", label: "Repeat __×", color: "bg-orange-500" },
    { type: "say", label: 'Say "__" for __s', color: "bg-purple-600" },
    { type: "think", label: 'Think "__" for __s', color: "bg-purple-600" },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between bg-indigo-600 text-white px-6 py-3 shadow-md">
        <h1 className="text-xl font-semibold tracking-wide">
          Visual Coding Playground
        </h1>
        <div className="flex gap-3">
          <button
            onClick={addSprite}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg transition whitespace-nowrap"
          >
            ➕ <span className="hidden sm:inline">New&nbsp;Sprite</span>
          </button>
          <button
            onClick={runAll}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition whitespace-nowrap"
          >
            ▶ <span className="hidden sm:inline">Play</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        {/* Toolbox */}
        <aside className="w-64 bg-gray-100 p-4 overflow-y-auto shadow-inner border-r border-gray-200">
          <h2 className="font-semibold text-lg mb-4 text-gray-800">Motion</h2>
          {toolboxBlocks
            .filter((b) => ["move", "turn", "goto", "repeat"].includes(b.type))
            .map((b) => (
              <div
                key={b.type}
                className={`block ${b.color} text-white rounded-md px-3 py-2 mb-2`}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", b.type)
                }
                title={b.label}
              >
                {b.label}
              </div>
            ))}
          <h2 className="font-semibold text-lg mb-4 mt-6 text-gray-800">
            Looks
          </h2>
          {toolboxBlocks
            .filter((b) => ["say", "think"].includes(b.type))
            .map((b) => (
              <div
                key={b.type}
                className={`block ${b.color} text-white rounded-md px-3 py-2 mb-2`}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", b.type)
                }
                title={b.label}
              >
                {b.label}
              </div>
            ))}
        </aside>

        {/* Code Area */}
        <section
          id="codeArea"
          className="grid-bg flex-1 border-r border-gray-200 relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleBlockDrop}
        >
          {!current && (
            <p className="absolute inset-0 m-auto w-max h-max text-gray-400 text-lg pointer-events-none">
              Select a sprite to program
            </p>
          )}
          <div id="blockContainer" className="p-4 space-y-2">
            {current &&
              current.code.map((b, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-md text-white text-sm shadow"
                  style={{ backgroundColor: colorMap(b.type) }}
                  title="Click to delete"
                  onClick={() => {
                    current.code.splice(i, 1);
                    updateSprite(current.id, { code: [...current.code] });
                  }}
                >
                  {label(b.type, b.params)}
                </div>
              ))}
          </div>
        </section>

        {/* Stage + Sprites list */}
        <aside className="w-1/2 bg-gray-100 p-4 flex flex-col shadow-inner">
          <h2 className="font-semibold text-lg mb-3 text-gray-800">Stage</h2>
          <div
            ref={stageRef}
            id="stage"
            className="flex-1 bg-blue-50 border rounded-lg relative overflow-hidden min-h-[220px]"
          >
            {sprites.map((sp) => (
              <div
                key={sp.id}
                className="sprite absolute rounded-full w-12 h-12 shadow-md"
                style={{
                  left: sp.x,
                  top: sp.y,
                  backgroundColor: sp.color,
                  transform: `rotate(${sp.dir}deg)`,
                }}
                onClick={() => setCurrentId(sp.id)}
              >
                {sp.emoji}
              </div>
            ))}
          </div>

          <h2 className="font-semibold text-lg mt-4 mb-2 text-gray-800">
            Sprites
          </h2>
          <ul id="spriteList" className="space-y-2 text-sm">
            {sprites.map((sp) => (
              <li
                key={sp.id}
                className={`px-3 py-2 rounded cursor-pointer hover:bg-gray-200 transition ${
                  currentId === sp.id ? "bg-amber-200" : ""
                }`}
                onClick={() => setCurrentId(sp.id)}
              >
                {sp.id} {sp.emoji}
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
