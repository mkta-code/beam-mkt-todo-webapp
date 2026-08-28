"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  date: string;
  title: string;
  type: string;
  owner: string;
  channel: string;
  priority: string;
  status: string;
  source: string;
  link?: string;
  note?: string;
};

type Project = {
  id: string;
  title: string;
  stage: string;
  priority: string;
  status: string;
  deadline: string;
  next: string;
};

type NewTaskForm = {
  targetTab: string;
  title: string;
  date: string;
  type: string;
  owner: string;
  channel: string;
  priority: string;
  status: string;
  link: string;
  note: string;
};

type GvizCell = {
  v?: string | number | boolean | null;
  f?: string;
};

type GvizResponse = {
  status: string;
  table?: {
    rows?: Array<{
      c?: Array<GvizCell | null>;
    }>;
  };
};

const sheetUrl =
  "https://docs.google.com/spreadsheets/d/1EncNnZvlN-ngAEYUlsdgDlcNHK4JJPAffiWzIUQt8CQ/edit";

const publicTodoFeedUrl =
  "https://docs.google.com/spreadsheets/d/1EncNnZvlN-ngAEYUlsdgDlcNHK4JJPAffiWzIUQt8CQ/gviz/tq";

const seededTasks: Task[] = [];

const seededProjects: Project[] = [];

const tabs = ["วันนี้", "เพิ่มงาน", "ตามงาน", "Project", "Content", "Inbox"];

const targetTabs = ["Inbox", "ตามงาน", "Project", "งานคลิป", "งาน Blog"];

const ownerOptions = [
  "พี่อร",
  "ใบตอง",
  "พี่ตูน",
  "พี่เป็ด",
  "พี่บิ๊ก",
  "พี่พิธ",
  "พี่แจม",
  "พี่เบิร์ด",
  "Beam",
];

const channelOptions = ["LINEOA", "Facebook", "Google", "YouTube", "-"];

const priorityOptions = [
  "🔴ด่วนมากตอนนี้",
  "🟠ด่วนภายในวันนี้",
  "🟡ไม่เกิน 1-2 วัน",
  "🟢ไม่ด่วน",
];

const statusOptions = ["Not Started", "Doing", "Follow-up", "Waiting", "Done"];

const initialForm: NewTaskForm = {
  targetTab: "Inbox",
  title: "",
  date: "",
  type: "",
  owner: "Beam",
  channel: "-",
  priority: "🟠ด่วนภายในวันนี้",
  status: "Not Started",
  link: "",
  note: "",
};

function priorityClass(priority: string) {
  if (priority.includes("🔴")) return "priorityNow";
  if (priority.includes("🟠")) return "priorityToday";
  if (priority.includes("🟡")) return "prioritySoon";
  return "priorityLater";
}

function countByStatus(tasks: Task[], status: string) {
  return tasks.filter((task) => task.status === status).length;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("วันนี้");
  const [tasks, setTasks] = useState<Task[]>(seededTasks);
  const [projects] = useState<Project[]>(seededProjects);
  const [syncUrl, setSyncUrl] = useState("");
  const [syncMessage, setSyncMessage] = useState("กำลังดึงข้อมูลจาก Google Sheet...");
  const [newTask, setNewTask] = useState<NewTaskForm>(initialForm);
  const [submitMessage, setSubmitMessage] = useState("กรอกงานแล้วกดส่งเข้าหลังบ้านได้เลย");

  useEffect(() => {
    const savedUrl = localStorage.getItem("beamMktSyncUrl") || "";
    if (savedUrl) {
      setSyncUrl(savedUrl);
      setSyncMessage("มี URL ที่บันทึกไว้แล้ว กด Sync เพื่อดึงข้อมูลล่าสุด");
      pullFromAppsScript(savedUrl);
      return;
    }

    pullFromPublicSheet();
  }, []);

  const visibleTasks = useMemo(() => {
    if (activeTab === "วันนี้") return tasks;
    if (activeTab === "Content") {
      return tasks.filter((task) => ["งานคลิป", "งาน Blog"].includes(task.source));
    }
    return tasks.filter((task) => task.source === activeTab);
  }, [activeTab, tasks]);

  async function pullFromSheet() {
    if (syncUrl.trim()) {
      await pullFromAppsScript(syncUrl.trim());
      return;
    }

    await pullFromPublicSheet();
  }

  async function pullFromAppsScript(urlText: string) {
    try {
      setSyncMessage("กำลังดึงข้อมูลจาก Google Sheet...");
      localStorage.setItem("beamMktSyncUrl", urlText);
      const callbackName = `beamMkt_${Date.now()}`;
      const url = new URL(urlText);
      url.searchParams.set("action", "loadMkt");
      url.searchParams.set("callback", callbackName);

      const data = await new Promise<{ ok: boolean; tasks?: Task[]; error?: string }>((resolve, reject) => {
        const script = document.createElement("script");
        const cleanup = () => {
          delete (window as unknown as Record<string, unknown>)[callbackName];
          script.remove();
        };
        (window as unknown as Record<string, unknown>)[callbackName] = (response: unknown) => {
          cleanup();
          resolve(response as { ok: boolean; tasks?: Task[]; error?: string });
        };
        script.onerror = () => {
          cleanup();
          reject(new Error("โหลดข้อมูลไม่ได้"));
        };
        script.src = url.toString();
        document.body.appendChild(script);
      });

      if (!data.ok) throw new Error(data.error || "Apps Script ส่งข้อมูลกลับมาไม่สำเร็จ");
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
      setSyncMessage("ดึงข้อมูลล่าสุดแล้ว");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sync ไม่สำเร็จ");
    }
  }

  async function pullFromPublicSheet() {
    try {
      setSyncMessage("กำลังดึงข้อมูลจาก Google Sheet...");
      const callbackName = `beamMktSheet_${Date.now()}`;
      const url = new URL(publicTodoFeedUrl);
      url.searchParams.set("sheet", "To do วันนี้");
      url.searchParams.set("tqx", `out:json;responseHandler:${callbackName}`);

      const data = await new Promise<GvizResponse>((resolve, reject) => {
        const script = document.createElement("script");
        const cleanup = () => {
          delete (window as unknown as Record<string, unknown>)[callbackName];
          script.remove();
        };
        (window as unknown as Record<string, unknown>)[callbackName] = (response: unknown) => {
          cleanup();
          resolve(response as GvizResponse);
        };
        script.onerror = () => {
          cleanup();
          reject(new Error("โหลดข้อมูลจาก Google Sheet ไม่ได้"));
        };
        script.src = url.toString();
        document.body.appendChild(script);
      });

      if (data.status !== "ok") throw new Error("Google Sheet ส่งข้อมูลกลับมาไม่สำเร็จ");
      setTasks(mapPublicSheetRows(data));
      setSyncMessage("ดึงข้อมูลจาก Google Sheet แล้ว (โหมดอ่านอย่างเดียว)");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Sync ไม่สำเร็จ");
    }
  }

  function mapPublicSheetRows(data: GvizResponse): Task[] {
    return (data.table?.rows || [])
      .map((row) => {
        const cells = row.c || [];
        const text = (index: number) => {
          const cell = cells[index];
          return String(cell?.f || cell?.v || "").trim();
        };

        return {
          id: text(0),
          date: text(1),
          title: text(2),
          type: text(3),
          owner: text(4),
          channel: text(5) || "-",
          priority: text(6),
          status: text(7),
          source: text(8),
          link: text(9),
          note: text(10),
        };
      })
      .filter((task) => task.id || task.title);
  }

  async function sendToSheet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!syncUrl.trim()) {
      setSubmitMessage("ตอนนี้ App ดึงข้อมูลจาก Sheet ได้แล้ว แต่ถ้าจะส่งงานกลับเข้า Sheet ต้องวาง Apps Script Web App URL ก่อนนะคะ");
      return;
    }

    if (!newTask.title.trim()) {
      setSubmitMessage("ใส่ชื่องานก่อนน้า");
      return;
    }

    try {
      setSubmitMessage("กำลังส่งงานเข้าหลังบ้าน...");
      localStorage.setItem("beamMktSyncUrl", syncUrl.trim());
      const callbackName = `beamMktAdd_${Date.now()}`;
      const url = new URL(syncUrl.trim());
      url.searchParams.set("action", "addMkt");
      url.searchParams.set("callback", callbackName);

      Object.entries(newTask).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const data = await new Promise<{ ok: boolean; error?: string; id?: string; tab?: string }>(
        (resolve, reject) => {
          const script = document.createElement("script");
          const cleanup = () => {
            delete (window as unknown as Record<string, unknown>)[callbackName];
            script.remove();
          };
          (window as unknown as Record<string, unknown>)[callbackName] = (response: unknown) => {
            cleanup();
            resolve(response as { ok: boolean; error?: string; id?: string; tab?: string });
          };
          script.onerror = () => {
            cleanup();
            reject(new Error("ส่งข้อมูลไม่ได้"));
          };
          script.src = url.toString();
          document.body.appendChild(script);
        },
      );

      if (!data.ok) throw new Error(data.error || "Apps Script บันทึกข้อมูลไม่สำเร็จ");
      setSubmitMessage(`ส่งเข้าแท็บ ${data.tab || newTask.targetTab} แล้ว: ${data.id || "สร้างแถวใหม่แล้ว"}`);
      setNewTask((current) => ({ ...initialForm, targetTab: current.targetTab }));
      await pullFromSheet();
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "ส่งงานไม่สำเร็จ");
    }
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandMark">
          <div className="brandLogo">M</div>
          <div>
            <strong>MKT Command</strong>
            <span>Beam daily system</span>
          </div>
        </div>

        <nav className="navList" aria-label="เมนูหลัก">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>

        <a className="sheetLink" href={sheetUrl} target="_blank" rel="noreferrer">
          เปิด Google Sheet
        </a>
      </aside>

      <section className="workspace">
        <header className="hero">
          <div>
            <p className="eyebrow">Pakorn.in.th Marketing</p>
            <h1>To do วันนี้ของบีม</h1>
            <p>
              หน้านี้เอาไว้ดูงานที่กระจายจาก Google Sheet แล้วรวมมาให้เห็นแบบไม่ลายตา
              พร้อมแยกตามงาน Project และ Content
            </p>
          </div>
          <div className="syncBox">
            <label htmlFor="syncUrl">Apps Script URL สำหรับเพิ่มงานกลับเข้า Sheet</label>
            <div className="syncInput">
              <input
                id="syncUrl"
                value={syncUrl}
                onChange={(event) => setSyncUrl(event.target.value)}
                placeholder="ไม่ใส่ก็ Sync อ่านข้อมูลได้"
              />
              <button type="button" onClick={pullFromSheet}>
                Sync
              </button>
            </div>
            <small>{syncMessage}</small>
          </div>
        </header>

        <section className="metricGrid" aria-label="สรุปงาน">
          <article>
            <span>งานทั้งหมดวันนี้</span>
            <strong>{tasks.length}</strong>
          </article>
          <article>
            <span>กำลังทำ</span>
            <strong>{countByStatus(tasks, "Doing")}</strong>
          </article>
          <article>
            <span>รอเริ่ม</span>
            <strong>{countByStatus(tasks, "Not Started")}</strong>
          </article>
          <article>
            <span>Project เปิดอยู่</span>
            <strong>{projects.filter((project) => project.status !== "Done").length}</strong>
          </article>
        </section>

        <section className="contentGrid">
          {activeTab === "เพิ่มงาน" ? (
            <div className="panel addTaskPanel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Quick Add</p>
                  <h2>เพิ่มงานเข้าหลังบ้าน</h2>
                </div>
              </div>

              <form className="addTaskForm wideForm" onSubmit={sendToSheet}>
                <label>
                  ส่งไปแท็บ
                  <select
                    value={newTask.targetTab}
                    onChange={(event) =>
                      setNewTask((current) => ({ ...current, targetTab: event.target.value }))
                    }
                  >
                    {targetTabs.map((tab) => (
                      <option key={tab} value={tab}>
                        {tab}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  งาน
                  <textarea
                    value={newTask.title}
                    onChange={(event) =>
                      setNewTask((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="เช่น ตามพี่บิ๊กเรื่องคลิป Facebook Ads"
                    rows={4}
                  />
                </label>

                <div className="formTwoCols">
                  <label>
                    วันที่
                    <input
                      type="date"
                      value={newTask.date}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    ประเภท
                    <input
                      value={newTask.type}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, type: event.target.value }))
                      }
                      placeholder="Content / Project"
                    />
                  </label>
                </div>

                <div className="formTwoCols">
                  <label>
                    คน/ทีม
                    <select
                      value={newTask.owner}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, owner: event.target.value }))
                      }
                    >
                      {ownerOptions.map((owner) => (
                        <option key={owner} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ช่องทาง
                    <select
                      value={newTask.channel}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, channel: event.target.value }))
                      }
                    >
                      {channelOptions.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="formTwoCols">
                  <label>
                    Priority
                    <select
                      value={newTask.priority}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, priority: event.target.value }))
                      }
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Status
                    <select
                      value={newTask.status}
                      onChange={(event) =>
                        setNewTask((current) => ({ ...current, status: event.target.value }))
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  Action/Link
                  <input
                    value={newTask.link}
                    onChange={(event) =>
                      setNewTask((current) => ({ ...current, link: event.target.value }))
                    }
                    placeholder="https://..."
                  />
                </label>

                <label>
                  หมายเหตุ
                  <textarea
                    value={newTask.note}
                    onChange={(event) =>
                      setNewTask((current) => ({ ...current, note: event.target.value }))
                    }
                    rows={3}
                  />
                </label>

                <button type="submit">ส่งเข้าหลังบ้าน</button>
                <small>{submitMessage}</small>
              </form>
            </div>
          ) : (
            <div className="panel taskPanel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">{activeTab}</p>
                  <h2>รายการงาน</h2>
                </div>
                <span>{visibleTasks.length} งาน</span>
              </div>

            <div className="taskList">
                {visibleTasks.length === 0 ? (
                  <div className="emptyState">
                    <h3>ยังไม่มีงานแสดงในหน้านี้</h3>
                    <p>
                      กด Sync เพื่อดึงงานจริงจาก Google Sheet มาแสดง ถ้าชีตเพิ่งแก้ อาจต้องรอสักครู่แล้วกดใหม่ค่ะ
                    </p>
                  </div>
                ) : null}

                {visibleTasks.map((task) => (
                  <article className="taskCard" key={task.id}>
                    <div className="taskTop">
                      <span className="taskId">{task.id}</span>
                      <span className={`priority ${priorityClass(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <h3>{task.title}</h3>
                    <div className="metaLine">
                      <span>{task.date}</span>
                      <span>{task.owner}</span>
                      <span>{task.channel}</span>
                      <span>{task.status}</span>
                    </div>
                    <footer>
                      <span>{task.source}</span>
                      {task.link ? (
                        <a href={task.link} target="_blank" rel="noreferrer">
                          เปิดลิงก์
                        </a>
                      ) : null}
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          )}

          <aside className="sideStack">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <p className="eyebrow">Project</p>
                  <h2>งานที่ต้องตามต่อ</h2>
                </div>
              </div>
              <div className="projectList">
                {projects.length === 0 ? (
                  <div className="emptyState compact">
                    <p>ยังไม่มี Project จาก Google Sheet แสดงตรงนี้</p>
                  </div>
                ) : null}

                {projects.map((project) => (
                  <article key={project.id}>
                    <span className="taskId">{project.id}</span>
                    <h3>{project.title}</h3>
                    <p>{project.next}</p>
                    <div className="metaLine">
                      <span>{project.stage}</span>
                      <span>{project.deadline}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel guideCard">
              <p className="eyebrow">ใช้ยังไง</p>
              <h2>Google Sheet เป็นหลังบ้าน</h2>
              <p>
                บีมกรอกงานจริงใน Sheet เหมือนเดิม แล้วเว็บนี้จะดึงงานจาก Google Sheet มาโชว์ให้อ่านง่ายกว่า
                ส่วน Apps Script URL ใช้เฉพาะตอนอยากเพิ่มงานจากหน้าเว็บกลับเข้า Sheet
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
