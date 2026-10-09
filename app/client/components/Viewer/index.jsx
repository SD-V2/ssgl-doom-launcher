import { ipcRenderer } from "electron";
import PropTypes from "prop-types";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { StoreContext } from "../../state";
import { useTranslation } from "../../utils";
import { showOpenDialog } from "../../utils/native";
import Box from "../Box";
import { Button, Dropdown, Input } from "../Form";
import { Buttons, Heading, Note } from "../Upscaler/parts";

// Tools > Graphics viewer: every picture of a mod (WAD or PK3) - Doom's own formats and PNG -
// as a grid of thumbnails. Only the rows on screen are drawn; their thumbnails are asked for
// when they come into view. A click shows the picture big, pixel by pixel.

const call = async (channel, data) => {
  const res = await ipcRenderer.invoke(channel, data);
  if (res && res.error) {
    const err = new Error(res.error);
    err.code = res.error;
    throw err;
  }
  return res ? res.data : null;
};

export const KINDS = [
  "sprite",
  "flat",
  "texture",
  "graphic",
  "patch",
  "hires",
  "other"
];
export const CELL_W = 132;
export const CELL_H = 168;
const THUMB = 96;

const CHECKER = `
  background-color: #2a2a2e;
  background-image: linear-gradient(45deg, #38383e 25%, transparent 25%),
    linear-gradient(-45deg, #38383e 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #38383e 75%),
    linear-gradient(-45deg, transparent 75%, #38383e 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
`;

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  align-items: flex-end;

  .wide {
    flex: 1 1 100%;
  }

  .field {
    width: 260px;
  }

  button {
    margin-bottom: 10px;
  }
`;

const Scroller = styled.div`
  position: relative;
  height: calc(100vh - 330px);
  min-height: 300px;
  overflow-y: auto;
  margin-top: 10px;
  border: 1px solid ${({ theme }) => theme.border.idle};
  ${({ theme }) => theme.scrollbar};
`;

const Cell = styled.button`
  position: absolute;
  width: ${CELL_W - 8}px;
  height: ${CELL_H - 8}px;
  padding: 4px;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: center;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.idle};
  cursor: pointer;
  overflow: hidden;

  &:hover,
  &:focus {
    border-color: ${({ theme }) => theme.color.active};
  }

  .pic {
    ${CHECKER}
    height: ${THUMB}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  img {
    image-rendering: pixelated;
    display: block;
  }

  .name {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: ${({ theme }) => theme.color.active};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: block;
    font-size: 11px;
    line-height: 1.3;
    color: ${({ theme }) => theme.color.meta};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Big = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;

  .pic {
    ${CHECKER}
    max-width: 92vw;
    max-height: 72vh;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.border.active};
  }

  img {
    display: block;
    image-rendering: pixelated;
  }

  p {
    margin: 0;
    color: #e8e8e8;
    font-size: 15px;
  }
`;

const typeLabel = (t, e) => t("tools:viewType_" + e.type);
const offsetText = e => (e.left || e.top ? `${e.left}, ${e.top}` : "");

// how big the big view shows a picture: whole times, as big as fits (at most 8x)
export const zoomFor = (w, h, maxW = 1100, maxH = 600) =>
  Math.max(1, Math.min(8, Math.floor(Math.min(maxW / w, maxH / h))));

const Viewer = ({ onBack }) => {
  const { t } = useTranslation(["tools", "common"]);
  const { gstate } = useContext(StoreContext);
  const [settings, setSettings] = useState({ palette: "", slade: "" });
  const [source, setSource] = useState("");
  const [list, setList] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [thumbs, setThumbs] = useState({});
  const [big, setBig] = useState(null);
  const [saved, setSaved] = useState("");
  const [view, setView] = useState({ top: 0, width: 0, height: 0 });
  const scroller = useRef(null);
  const asked = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    call("viewer/settings")
      .then(s => alive.current && s && setSettings(s))
      .catch(() => null);
    return () => {
      alive.current = false;
    };
  }, []);

  const sources = useMemo(
    () =>
      (gstate.iwads || [])
        .filter(i => i.path)
        .map(i => ({ label: i.name + " (" + i.kind + ")", value: i.path }))
        .concat(
          (gstate.mods || [])
            .filter(m => /^(WAD|PK3|ZIP|PK7|IPK3)$/i.test(m.kind))
            .slice()
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true })
            )
            .map(m => ({ label: m.name + " (" + m.kind + ")", value: m.path }))
        ),
    [gstate.iwads, gstate.mods]
  );

  const open = async file => {
    setSource(file);
    setList(null);
    setThumbs({});
    asked.current = new Set();
    setError("");
    setBig(null);
    if (!file) return;
    setReading(true);
    try {
      const l = await call("viewer/open", file);
      if (alive.current) setList(l);
    } catch (e) {
      if (alive.current) setError(e.code || "failed");
    }
    if (alive.current) setReading(false);
    if (scroller.current) scroller.current.scrollTop = 0;
  };

  const onOpenFile = async () => {
    const res = await showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "WAD / PK3",
          extensions: ["wad", "pk3", "zip", "ipk3", "pk7", "iwad"]
        }
      ]
    });
    if (res && !res.canceled && res.filePaths && res.filePaths[0])
      open(res.filePaths[0]);
  };

  const choosePalette = async file => {
    const s = await call("viewer/settings", { palette: file }).catch(
      () => null
    );
    if (s) setSettings(s);
    open(source);
  };

  const chooseSlade = async () => {
    const res = await showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "SLADE", extensions: ["exe", "*"] }]
    });
    if (!res || res.canceled || !res.filePaths || !res.filePaths[0]) return;
    const s = await call("viewer/settings", { slade: res.filePaths[0] }).catch(
      () => null
    );
    if (s) setSettings(s);
  };

  // ---- the grid: what is shown, which rows are on screen -----------------------------------
  const shown = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toUpperCase();
    return list.entries.filter(
      e => (kind === "all" || e.kind === kind) && (!q || e.name.indexOf(q) > -1)
    );
  }, [list, kind, search]);

  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    setView({
      top: el.scrollTop,
      width: el.clientWidth || 960,
      height: el.clientHeight || 600
    });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [list]);

  // another filter or search: back to the top (the old place may be past the end)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
    measure();
  }, [kind, search]);

  const cols = Math.max(1, Math.floor((view.width || 960) / CELL_W));
  const rows = Math.ceil(shown.length / cols);
  const first = Math.max(0, Math.floor(view.top / CELL_H) - 1);
  const last = Math.min(
    rows,
    Math.ceil((view.top + (view.height || 600)) / CELL_H) + 1
  );
  const visible = shown.slice(first * cols, last * cols);

  // thumbnails of the pictures on screen, a batch at a time
  useEffect(() => {
    if (!source || !visible.length) return undefined;
    if (!visible.some(e => !asked.current.has(e.id))) return undefined;
    // marked as asked only when the request goes out (a new layout may cancel the timer)
    const timer = setTimeout(async () => {
      const want = visible.map(e => e.id).filter(id => !asked.current.has(id));
      if (!want.length) return;
      want.forEach(id => asked.current.add(id));
      try {
        const got = await call("viewer/thumbs", {
          source,
          ids: want,
          size: THUMB
        });
        if (!alive.current) return;
        setThumbs(prev => {
          const next = { ...prev };
          (got || []).forEach(g => {
            next[g.id] = g;
          });
          return next;
        });
      } catch (e) {
        want.forEach(id => asked.current.delete(id));
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [source, first, last, cols, shown]);

  const showBig = async e => {
    setSaved("");
    setBig({ entry: e, url: "" });
    try {
      const p = await call("viewer/picture", { source, id: e.id });
      if (alive.current) setBig({ entry: e, url: p.url });
    } catch (err) {
      if (alive.current) setBig({ entry: e, url: "", error: err.code });
    }
  };

  const save = async () => {
    try {
      const r = await call("viewer/save", {
        source,
        id: big.entry.id,
        title: t("tools:viewSave")
      });
      if (r && r.file) setSaved(r.file);
    } catch (e) {
      setSaved("");
    }
  };

  useEffect(() => {
    if (!big) return undefined;
    const onKey = ev => ev.key === "Escape" && setBig(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  const counts = useMemo(() => {
    const c = {};
    ((list && list.entries) || []).forEach(e => {
      c[e.kind] = (c[e.kind] || 0) + 1;
    });
    return c;
  }, [list]);

  const zoom = big ? zoomFor(big.entry.width, big.entry.height) : 1;

  return (
    <Box>
      <div data-viewer={reading ? "reading" : list ? "list" : "start"}>
        <Buttons>
          <Button onClick={onBack} width="150px" data-back>
            {t("tools:back")}
          </Button>
        </Buttons>
        <Heading>{t("tools:viewerName")}</Heading>
        <Bar>
          <div className="wide">
            <Dropdown
              name="viewerSource"
              label={t("tools:viewPick")}
              fluid
              value={source}
              options={sources}
              onChange={({ value }) => open(value)}
            />
          </div>
          <Button onClick={onOpenFile} width="170px">
            {t("tools:viewOpenFile")}
          </Button>
          {list ? (
            <div className="field">
              <Dropdown
                name="viewerKind"
                label={t("tools:viewKind")}
                fluid
                value={kind}
                options={[
                  {
                    label:
                      t("tools:viewKind_all") +
                      " (" +
                      list.entries.length +
                      ")",
                    value: "all"
                  }
                ].concat(
                  KINDS.filter(k => counts[k]).map(k => ({
                    label: t("tools:viewKind_" + k) + " (" + counts[k] + ")",
                    value: k
                  }))
                )}
                onChange={({ value }) => setKind(value)}
              />
            </div>
          ) : null}
          {list ? (
            <div className="field">
              <Input
                name="viewerSearch"
                label={t("tools:viewSearch")}
                fluid
                value={search}
                onChange={e =>
                  setSearch((e && e.target && e.target.value) || "")
                }
              />
            </div>
          ) : null}
          {list && settings.slade ? (
            <Button
              onClick={() => call("viewer/slade", source).catch(() => null)}
              width="170px"
              data-slade
            >
              {t("tools:viewSlade")}
            </Button>
          ) : null}
          <Button onClick={chooseSlade} width="170px" data-slade-set>
            {t("tools:viewSladeSet")}
          </Button>
        </Bar>
        {reading ? <Note>{t("tools:viewReading")}</Note> : null}
        {error ? <Note bad>{t("tools:viewFailed")}</Note> : null}
        {list && list.palette !== "mod" ? (
          <Bar data-viewer-palette={list.palette || "need"}>
            <div className="field">
              <Dropdown
                name="viewerPalette"
                label={t("tools:paletteGame")}
                fluid
                value={settings.palette}
                options={(gstate.iwads || [])
                  .filter(i => i.path)
                  .map(i => ({
                    label: i.name + " (" + i.kind + ")",
                    value: i.path
                  }))}
                onChange={({ value }) => choosePalette(value)}
              />
            </div>
            {!list.palette ? <Note bad>{t("tools:viewNoPalette")}</Note> : null}
          </Bar>
        ) : null}
        {list ? (
          <Note dir="ltr" data-viewer-count>
            {t("tools:viewCount", {
              n: list.entries.length,
              shown: shown.length
            })}
            {list.bad ? " - " + t("tools:badPictures", { n: list.bad }) : ""}
            {list.unsupported.length
              ? " - " +
                t("tools:viewUnsupported", { n: list.unsupported.length })
              : ""}
          </Note>
        ) : null}
        {list && !list.entries.length ? (
          <Note>{t("tools:viewEmpty")}</Note>
        ) : null}
        <Scroller
          ref={scroller}
          onScroll={measure}
          data-viewer-grid
          hidden={!list}
        >
          <div style={{ height: rows * CELL_H, position: "relative" }}>
            {visible.map((e, i) => {
              const n = first * cols + i;
              const th = thumbs[e.id];
              return (
                <Cell
                  key={e.id}
                  type="button"
                  style={{
                    left: (n % cols) * CELL_W + 4,
                    top: Math.floor(n / cols) * CELL_H + 4
                  }}
                  onClick={() => showBig(e)}
                  data-entry={e.name}
                  data-kind={e.kind}
                  title={e.path}
                >
                  <span className="pic">
                    {th && th.url ? <img src={th.url} alt="" /> : null}
                    {th && th.error ? (
                      <span className="meta">{t("tools:viewThumbError")}</span>
                    ) : null}
                  </span>
                  <span className="name">{e.name}</span>
                  <span className="meta">
                    {typeLabel(t, e)} - {e.width}x{e.height}
                  </span>
                  <span className="meta">
                    {offsetText(e)
                      ? t("tools:viewOffset", { x: e.left, y: e.top })
                      : " "}
                  </span>
                </Cell>
              );
            })}
          </div>
        </Scroller>
        {big ? (
          <Big
            data-viewer-big={big.entry.name}
            onClick={ev => ev.target === ev.currentTarget && setBig(null)}
          >
            <p dir="ltr">
              {big.entry.name} - {t("tools:viewKind_" + big.entry.kind)} -{" "}
              {typeLabel(t, big.entry)} - {big.entry.width}x{big.entry.height}
              {offsetText(big.entry)
                ? " - " +
                  t("tools:viewOffset", { x: big.entry.left, y: big.entry.top })
                : ""}{" "}
              - {zoom}x
            </p>
            <div className="pic">
              {big.url ? (
                <img
                  src={big.url}
                  alt=""
                  style={{
                    width: big.entry.width * zoom,
                    height: big.entry.height * zoom
                  }}
                />
              ) : null}
            </div>
            {big.error ? <p>{t("tools:viewThumbError")}</p> : null}
            {saved ? (
              <p dir="ltr">{t("tools:viewSaved", { file: saved })}</p>
            ) : null}
            <Buttons>
              <Button onClick={save} width="170px" disabled={!big.url}>
                {t("tools:viewSave")}
              </Button>
              <Button onClick={() => setBig(null)} width="120px">
                {t("tools:viewClose")}
              </Button>
            </Buttons>
          </Big>
        ) : null}
      </div>
    </Box>
  );
};

Viewer.propTypes = {
  onBack: PropTypes.func.isRequired
};

export default Viewer;
