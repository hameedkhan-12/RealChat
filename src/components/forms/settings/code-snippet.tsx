'use client'
import Section from '@/components/section-label'
import { useToast } from '@/components/ui/use-toast'
import { Copy } from 'lucide-react'
import React, { useEffect, useState } from 'react'

type Props = {
  id: string
}

const CodeSnippet = ({ id }: Props) => {
  const { toast } = useToast()
  const [origin, setOrigin] = useState('http://localhost:3000')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const snippet = `<script>
  (function () {
    const iframe = document.createElement("iframe");
    
    const style = document.createElement("style");
    style.textContent = \`
      .chat-frame {
        position: fixed;
        bottom: 30px;
        right: 30px;
        border: none;
        background: transparent !important;
        color-scheme: normal;
        z-index: 999999;
      }
    \`;
    document.head.appendChild(style);

    iframe.src = "${origin}/chatbot";
    iframe.classList.add("chat-frame");
    iframe.setAttribute("allowtransparency", "true");
    iframe.style.background = "transparent";
    // Start collapsed so there's no black box while loading
    iframe.width = "0";
    iframe.height = "0";
    document.body.appendChild(iframe);

    let idSent = false;
    const sendId = () => {
      if (idSent) return;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage("${id}", "*");
      }
    };

    iframe.addEventListener("load", sendId);

    window.addEventListener("message", (e) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!data) return;
        // Chatbot is ready — send the domain ID (once)
        if (data.type === "CORINNA_READY") {
          sendId();
          idSent = true;
        }
        // Resize iframe to match chatbot dimensions
        if (data.width && data.height) {
          iframe.width = data.width;
          iframe.height = data.height;
        }
      } catch (err) {}
    });
  })();
</script>`

  return (
    <div className="mt-10 flex flex-col gap-5 items-start">
      <Section
        label="Code snippet"
        message="Copy and paste this code snippet into your website to embed your chatbot"
      />
      <div className="bg-cream dark:bg-muted p-6 rounded-lg inline-block relative max-w-full">
        <Copy
          className="absolute top-5 right-5 text-gray-400 hover:text-foreground cursor-pointer transition-colors"
          onClick={() => {
            navigator.clipboard.writeText(snippet)
            toast({
              title: 'Copied to clipboard',
              description: 'You can now paste the code inside your website',
            })
          }}
        />
        <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap pr-10">
          {snippet}
        </pre>
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Domain ID:</span>{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
            {id}
          </code>
        </p>
      </div>
    </div>
  )
}

export default CodeSnippet
