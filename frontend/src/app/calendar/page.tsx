"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
  Input,
  useDisclosure,
} from "@nextui-org/react";
import { Calendar as CalendarIcon, List, Plus, Sparkles } from "lucide-react";
import { createCalendarEvent, useCalendarEvents } from "@/lib/hooks";
import {
  bauhausFieldClassNames,
  bauhausModalContentClassName,
  bauhausTabsClassNames,
} from "@/lib/bauhaus";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";

export default function CalendarPage() {
  const { data: events, mutate } = useCalendarEvents();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [viewMode, setViewMode] = useState<string>("calendar");
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    location: "",
  });

  const calendarEvents = useMemo(() => {
    if (!events) return [];
    return events.map((event) => ({
      id: String(event.id),
      title: event.title,
      start: event.start_time,
      end: event.end_time || undefined,
      backgroundColor:
        event.event_type === "interview"
          ? "#1040C0"
          : event.event_type === "deadline"
            ? "#D02020"
            : "#F0C020",
      borderColor: "#121212",
      textColor: event.event_type === "deadline" || event.event_type === "interview" ? "#FFFFFF" : "#121212",
      extendedProps: {
        location: event.location,
        description: event.description,
        event_type: event.event_type,
      },
    }));
  }, [events]);

  const handleDateClick = (info: { dateStr: string }) => {
    setNewEvent((prev) => ({ ...prev, start_time: `${info.dateStr}T09:00` }));
    onOpen();
  };

  const handleCreate = async () => {
    if (!newEvent.title || !newEvent.start_time) return;
    await createCalendarEvent({
      ...newEvent,
      start_time: new Date(newEvent.start_time).toISOString(),
      end_time: newEvent.end_time ? new Date(newEvent.end_time).toISOString() : null,
      event_type: "interview",
    });
    setNewEvent({ title: "", description: "", start_time: "", end_time: "", location: "" });
    onClose();
    mutate();
  };

  const typeTone = (type: string) => {
    switch (type) {
      case "interview":
        return "bg-[#1040C0] text-white";
      case "deadline":
        return "bg-[#D02020] text-white";
      default:
        return "bg-[#F0C020] text-black";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="space-y-8"
    >
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#F0C020]">Interview Calendar</span>
            <div>
              <p className="bauhaus-label text-black/55">Schedule Board</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Plan
                <br />
                Time
                <br />
                Move
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                把笔试、面试和截止日期收束到一块几何日历板上，避免信息散落在邮件和聊天记录里，
                让后续准备和时间冲突一眼可见。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm bg-[#1040C0] p-4 text-white">
              <p className="bauhaus-label text-white/70">Events</p>
              <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">{events?.length ?? 0}</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#F0C020] p-4 text-black">
              <p className="bauhaus-label text-black/60">Modes</p>
              <p className="mt-3 text-4xl font-black uppercase tracking-[-0.08em]">2</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#D02020] p-4 text-white">
              <p className="bauhaus-label text-white/70">Capture</p>
              <p className="mt-3 text-lg font-black uppercase tracking-[-0.05em]">Interview / Deadline</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          size="sm"
          selectedKey={viewMode}
          onSelectionChange={(key) => setViewMode(key as string)}
          classNames={bauhausTabsClassNames}
        >
          <Tab key="calendar" title={<span className="inline-flex items-center gap-2"><CalendarIcon size={14} /> 日历</span>} />
          <Tab key="list" title={<span className="inline-flex items-center gap-2"><List size={14} /> 列表</span>} />
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Button startContent={<Sparkles size={16} />} className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]">
            AI 自动填充
          </Button>
          <Button startContent={<Plus size={16} />} onPress={onOpen} className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]">
            添加日程
          </Button>
        </div>
      </section>

      {viewMode === "calendar" && (
        <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
          <CardBody className="fullcalendar-dark p-4 md:p-5">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={calendarEvents}
              dateClick={handleDateClick}
              height="auto"
              locale="zh-cn"
              buttonText={{ today: "今天", month: "月", week: "周", day: "日" }}
            />
          </CardBody>
        </Card>
      )}

      {viewMode === "list" && (
        events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <Card className="bauhaus-panel rounded-none bg-white shadow-none">
                  <CardBody className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`bauhaus-panel-sm flex h-12 w-12 items-center justify-center ${typeTone(event.event_type)}`}>
                        <CalendarIcon size={18} />
                      </div>
                      <div>
                        <p className="text-xl font-black tracking-[-0.04em] text-black">{event.title}</p>
                        <p className="mt-2 text-sm font-medium text-black/60">
                          {new Date(event.start_time).toLocaleString("zh-CN")}
                          {event.location && ` · ${event.location}`}
                        </p>
                        {event.description && (
                          <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-black/68">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="bauhaus-panel rounded-none bg-[#1040C0] text-white shadow-none">
            <CardBody className="p-10 text-center">
              <CalendarIcon size={54} className="mx-auto" />
              <p className="mt-4 text-2xl font-black uppercase tracking-[-0.05em]">No Events Yet</p>
              <p className="mt-3 text-sm font-medium text-white/80">
                点击「添加日程」或使用 AI 自动填充，把面试和截止时间收拢进这块时间板。
              </p>
            </CardBody>
          </Card>
        )
      )}

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black bg-[#F0C020] px-6 py-5 text-xl font-black tracking-[-0.06em]">
            添加日程
          </ModalHeader>
          <ModalBody className="space-y-3 px-6 py-6">
            <Input label="标题" variant="bordered" value={newEvent.title} onValueChange={(v) => setNewEvent((p) => ({ ...p, title: v }))} classNames={bauhausFieldClassNames} />
            <Input label="开始时间" variant="bordered" type="datetime-local" value={newEvent.start_time} onValueChange={(v) => setNewEvent((p) => ({ ...p, start_time: v }))} classNames={bauhausFieldClassNames} />
            <Input label="结束时间" variant="bordered" type="datetime-local" value={newEvent.end_time} onValueChange={(v) => setNewEvent((p) => ({ ...p, end_time: v }))} classNames={bauhausFieldClassNames} />
            <Input label="地点" variant="bordered" value={newEvent.location} onValueChange={(v) => setNewEvent((p) => ({ ...p, location: v }))} classNames={bauhausFieldClassNames} />
            <Input label="描述" variant="bordered" value={newEvent.description} onValueChange={(v) => setNewEvent((p) => ({ ...p, description: v }))} classNames={bauhausFieldClassNames} />
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button variant="light" onPress={onClose} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
              取消
            </Button>
            <Button onPress={handleCreate} className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]">
              创建
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
