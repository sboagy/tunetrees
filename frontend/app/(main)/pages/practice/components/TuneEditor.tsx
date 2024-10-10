import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, X } from "lucide-react";

interface IExternalRef {
  url: string;
  note: string;
  type: string;
}

export default function TuneEditor() {
  const [formData, setFormData] = useState({
    id: "1", // Set a default value for the read-only ID field
    title: "",
    type: "",
    structure: "",
    mode: "",
    incipit: "",
    learned: "",
    practiced: "",
    quality: "",
    easiness: "",
    interval: "",
    repetitions: "",
    reviewDate: "",
    notePrivate: "",
    notePublic: "",
    tags: "",
  });

  const [externalRefs, setExternalRefs] = useState<IExternalRef[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleExternalRefChange = (
    index: number,
    field: keyof IExternalRef,
    value: string,
  ) => {
    setExternalRefs((prev) => {
      const newRefs = [...prev];
      newRefs[index] = { ...newRefs[index], [field]: value };
      return newRefs;
    });
  };

  const addExternalRef = () => {
    setExternalRefs((prev) => [
      ...prev,
      { url: "", note: "", type: "website" },
    ]);
  };

  const removeExternalRef = (index: number) => {
    setExternalRefs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ ...formData, externalRefs });
    // Here you would typically send the data to your backend
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-2xl mx-auto p-6 bg-white rounded-lg shadow"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="id">ID</Label>
          <Input
            type="text"
            id="id"
            name="id"
            value={formData.id}
            readOnly
            className="bg-gray-100"
          />
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select
            onValueChange={handleSelectChange("type")}
            value={formData.type}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="type1">Type 1</SelectItem>
              <SelectItem value="type2">Type 2</SelectItem>
              <SelectItem value="type3">Type 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="structure">Structure</Label>
          <Input
            type="text"
            id="structure"
            name="structure"
            value={formData.structure}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="mode">Mode</Label>
          <Select
            onValueChange={handleSelectChange("mode")}
            value={formData.mode}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mode1">Mode 1</SelectItem>
              <SelectItem value="mode2">Mode 2</SelectItem>
              <SelectItem value="mode3">Mode 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="incipit">Incipit</Label>
          <Input
            type="text"
            id="incipit"
            name="incipit"
            value={formData.incipit}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="learned">Learned</Label>
          <Input
            type="date"
            id="learned"
            name="learned"
            value={formData.learned}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="practiced">Practiced</Label>
          <Input
            type="date"
            id="practiced"
            name="practiced"
            value={formData.practiced}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="quality">Quality</Label>
          <Select
            onValueChange={handleSelectChange("quality")}
            value={formData.quality}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="easiness">Easiness</Label>
          <Input
            type="number"
            step="0.1"
            id="easiness"
            name="easiness"
            value={formData.easiness}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="interval">Interval</Label>
          <Input
            type="number"
            id="interval"
            name="interval"
            value={formData.interval}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="repetitions">Repetitions</Label>
          <Input
            type="number"
            id="repetitions"
            name="repetitions"
            value={formData.repetitions}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="reviewDate">Review Date</Label>
          <Input
            type="date"
            id="reviewDate"
            name="reviewDate"
            value={formData.reviewDate}
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notePrivate">Private Note</Label>
        <Textarea
          id="notePrivate"
          name="notePrivate"
          value={formData.notePrivate}
          onChange={handleChange}
        />
      </div>

      <div>
        <Label htmlFor="notePublic">Public Note</Label>
        <Textarea
          id="notePublic"
          name="notePublic"
          value={formData.notePublic}
          onChange={handleChange}
        />
      </div>

      <div>
        <Label htmlFor="tags">Tags</Label>
        <Input
          type="text"
          id="tags"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>External References</Label>
          <Button
            type="button"
            onClick={addExternalRef}
            variant="outline"
            size="sm"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Reference
          </Button>
        </div>
        {externalRefs.map((ref, index) => (
          // See https://robinpokorny.com/blog/index-as-a-key-is-an-anti-pattern/
          // Not sure if this is something to worry about in this case, but,
          // in any case, I want to wait until I have a better understanding of
          // of this component before further refactoring it.
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <div key={index} className="space-y-2 p-4 border rounded-md relative">
            <Button
              type="button"
              onClick={() => removeExternalRef(index)}
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
            >
              <X className="w-4 h-4" />
            </Button>
            <div>
              <Label htmlFor={`ref-url-${index}`}>URL</Label>
              <Input
                type="url"
                id={`ref-url-${index}`}
                value={ref.url}
                onChange={(e) =>
                  handleExternalRefChange(index, "url", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor={`ref-note-${index}`}>Note</Label>
              <Textarea
                id={`ref-note-${index}`}
                value={ref.note}
                onChange={(e) =>
                  handleExternalRefChange(index, "note", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor={`ref-type-${index}`}>Type</Label>
              <Input
                type="text"
                id={`ref-type-${index}`}
                value={ref.type}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full">
        Submit
      </Button>
    </form>
  );
}
