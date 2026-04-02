// =============================================
// 日程表页 — FullCalendar 面试日程管理
// =============================================
// 主视图：FullCalendar 月/周/日历视图
// 交互：点击日期创建事件、点击事件查看详情
// 侧栏：最近事件概览列表
// =============================================

"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Card, CardBody, Button, Modal, ModalContent,
  ModalHeader, ModalBody, ModalFooter, Input,
  useDisclosure, Tabs, Tab,
} from "@nextui-org/react";
import { Sparkles, Plus, Calendar as CalendarIcon, List } from "lucide-react";
import { useCalendarEvents, createCalendarEvent } from "@/lib/hooks";

// FullCalendar 动态导入（避免 SSR 问题）
const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarPage() {
  const { data: events, mutate } = useCalendarEvents();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [viewMode, setViewMode] = useState<string>("calendar");
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", start_time: "", end_time: "", location: "",
  });

  /** 将 API 事件转为 FullCalendar 事件格式 */
  const calendarEvents = useMemo(() => {
    if (!events) return [];
    return events.map((e) => ({
      id: String(e.id),
      title: e.title,
      start: e.start_time,
      end: e.end_time || undefined,
      backgroundColor:
        e.event_type === "interview" ? "#3b82f6" :
        e.event_type === "deadline" ? "#ef4444" : "#6b7280",
      borderColor: "transparent",
      extendedProps: {
        location: e.location,
        description: e.description,
        event_type: e.event_type,
      },
    }));
  }, [events]);

  /** 点击日历空白日期 → 打开创建弹窗并预填时间 */
  const handleDateClick = (info: { dateStr: string }) => {
    setNewEvent((prev) => ({ ...prev, start_time: info.dateStr + "T09:00" }));
    onOpen();
  };

  /** 创建新日程事件 */
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

  /** 事件类型颜色映射 */
  const typeColor = (type: string) => {
    switch (type) {
      case "interview": return "bg-blue-500/20 border-blue-500/50 text-blue-300";
      case "deadline": return "bg-red-500/20 border-red-500/50 text-red-300";
      default: return "bg-white/10 border-white/20 text-white/70";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">日程表</h1>
        <div className="flex gap-2">
          <Tabs
            size="sm"
            selectedKey={viewMode}
            onSelectionChange={(k) => setViewMode(k as string)}
          >
            <Tab key="calendar" title={<CalendarIcon size={14} />} />
            <Tab key="list" title={<List size={14} />} />
          </Tabs>
          <Button
            startContent={<Sparkles size={16} />}
            color="secondary"
            size="sm"
            variant="flat"
          >
            AI 自动填充
          </Button>
          <Button
            startContent={<Plus size={16} />}
            color="primary"
            size="sm"
            onPress={onOpen}
          >
            添加日程
          </Button>
        </div>
      </div>

      {/* FullCalendar 视图 */}
      {viewMode === "calendar" && (
        <Card className="bg-white/5 border border-white/10">
          <CardBody className="p-4 fullcalendar-dark">
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
              buttonText={{
                today: "今天",
                month: "月",
                week: "周",
                day: "日",
              }}
            />
          </CardBody>
        </Card>
      )}

      {/* 列表视图 */}
      {viewMode === "list" && (
        events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card className="bg-white/5 border border-white/10">
                  <CardBody className="flex flex-row items-center gap-4 p-4">
                    <div className={`p-2 rounded-lg border ${typeColor(event.event_type)}`}>
                      <CalendarIcon size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{event.title}</p>
                      <p className="text-sm text-white/50">
                        {new Date(event.start_time).toLocaleString("zh-CN")}
                        {event.location && ` · ${event.location}`}
                      </p>
                      {event.description && (
                        <p className="text-xs text-white/40 mt-1">{event.description}</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="bg-white/5 border border-white/10">
            <CardBody className="p-8 text-center text-white/40">
              <CalendarIcon size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">暂无日程</p>
              <p className="text-sm">点击"添加日程"手动创建，或使用"AI 自动填充"</p>
            </CardBody>
          </Card>
        )
      )}

      {/* 创建日程 Modal */}
      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent className="bg-[#1a1a2e] border border-white/10">
          <ModalHeader>添加日程</ModalHeader>
          <ModalBody className="space-y-3">
            <Input label="标题" variant="bordered" value={newEvent.title} onValueChange={(v) => setNewEvent((p) => ({ ...p, title: v }))} />
            <Input label="开始时间" variant="bordered" type="datetime-local" value={newEvent.start_time} onValueChange={(v) => setNewEvent((p) => ({ ...p, start_time: v }))} />
            <Input label="结束时间" variant="bordered" type="datetime-local" value={newEvent.end_time} onValueChange={(v) => setNewEvent((p) => ({ ...p, end_time: v }))} />
            <Input label="地点" variant="bordered" value={newEvent.location} onValueChange={(v) => setNewEvent((p) => ({ ...p, location: v }))} />
            <Input label="描述" variant="bordered" value={newEvent.description} onValueChange={(v) => setNewEvent((p) => ({ ...p, description: v }))} />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>取消</Button>
            <Button color="primary" onPress={handleCreate}>创建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
