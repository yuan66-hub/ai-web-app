'use client'
import './globals.css'
import '@ant-design/v5-patch-for-react-19';
import {
  Bubble,
  Sender,
  useXAgent,
  useXChat,
} from '@ant-design/x';
import { createStyles } from 'antd-style';
import { Typography, Space, Button as AButton } from 'antd';
import markdownit from 'markdown-it';
import { UserOutlined, SyncOutlined, CopyOutlined } from '@ant-design/icons';
import React, { useEffect } from 'react';
import type { GetProp } from 'antd';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

const md = markdownit({ html: true, breaks: true });

// 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
const useStyle = createStyles(({ token, css }) => {
  return {
    layout: css`
      width: 100%;
      height: 100%;
      min-width: 1000px;
      border-radius: ${token.borderRadius}px;
      display: flex;
      background: ${token.colorBgContainer};
      font-family: AlibabaPuHuiTi, ${token.fontFamily}, sans-serif;
      .ant-prompts {
        color: ${token.colorText};
      }
    `,
    btn: css`
      position: absolute;
      top:10px;
      left:10px;
    `,
    chat: css`
      height: calc(100vh - 32px);
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: ${token.paddingLG}px;
      gap: 16px;
    `,

    messages: css`
      flex:1
    `,
    sender: css`
      box-shadow: ${token.boxShadow};
    `,
  };
});

const roles: GetProp<typeof Bubble.List, 'roles'> = {
  assistant: {
    placement: 'start',
    typing: { step: 5, interval: 20 },
    header: 'AI助手',
    styles: {
      content: {
        borderRadius: 16,
      },
    },
    footer: (
      <Space>
        <AButton color="default" variant="text" size="small" icon={<SyncOutlined />} />
        <AButton color="default" variant="text" size="small" icon={<CopyOutlined />} />
      </Space>
    ),
    avatar: { icon: <UserOutlined />, style: { background: '#87d068' } },

    messageRender: (content) => {
      return (
        <Typography>
          <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
        </Typography>
      );
    },
  },
  user: {
    placement: 'end',
    variant: 'shadow',
    styles: {
      content: {
        backgroundColor: '#fde3cf',
      },
    },
    header: 'You',
    avatar: { icon: <UserOutlined />, style: { background: '#fde3cf' } },
    messageRender: (content) => {
      const text: any = JSON.parse(content)
      return (
        <Typography>
          <div dangerouslySetInnerHTML={{ __html: md.render(text.content) }} />
        </Typography>
      );
    },
  },
};




const Home: React.FC = () => {
  const { styles } = useStyle();
  //  输入框内容
  const [content, setContent] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState<string>('');

  const [agent] = useXAgent({
    request: async ({ messages = [] }, { onSuccess, onUpdate }) => {
      await fetchData(messages, onUpdate, onSuccess);
    },
  });

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const fetchData = async (messages: any, onUpdate: any, onSuccess: any) => {
    const openrouterkey = localStorage.getItem('openrouterkey');
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterkey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "mistralai/mistral-7b-instruct:free",
        "messages": messages.map((item: string) => {
           try {
             return  JSON.parse(item)
           } catch (error) {
              return {
                 role:'assistant',
                 content:item
              }
           }
        }),
        stream: true,
      })
    });
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let text = ''
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onSuccess(text);
          break;
        }
        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });
        // Process complete lines from buffer
        while (true) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onSuccess(text);
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0].delta;
              if (delta.content) {
                text += delta.content
                onUpdate(text);
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
              // Ignore invalid JSON
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }

  };

  const { onRequest, messages } = useXChat({
    agent,
  });
  //  消息列表
  const items: GetProp<typeof Bubble.List, 'items'> = messages.map(({ id, message, status }: any) => ({
    key: id,
    type: 'text',
    loading: status === 'loading',
    role: status === 'local' ? 'user' : "assistant",
    content: message,
  }));


  // 发送提示词
  const onSubmit = (nextContent: string) => {
    if (!nextContent) return;
    onRequest(JSON.stringify({
      type: 'text',
      role: 'user',
      content: nextContent,
    }));
    setContent('');
  };





  return (
    <>
      <div className={styles.layout}>
        <IconButton onClick={handleClickOpen} aria-label="add" className={styles.btn}>
          <AddIcon />
        </IconButton>
        <div className={styles.chat}>
          {/* 🌟 消息列表 */}
          <Bubble.List
            items={items.length > 0 ? items : [{ content: <></>, variant: 'borderless' }]}
            roles={roles}
            className={styles.messages}
          />
          {/* 🌟 输入框 */}
          <Sender
            value={content}
            onSubmit={onSubmit}
            onChange={setContent}
            loading={agent?.isRequesting() || false}
            className={styles.sender}
          />
        </div>
      </div>
      <Dialog
        open={open}
        fullWidth={true}
        onClose={handleClose}
        slotProps={{
          paper: {
            component: 'form',
            onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const formJson = Object.fromEntries((formData as any).entries());
              const key = formJson.key;
              localStorage.setItem('openrouterkey', key)
              setKey(key)
              handleClose();
            },
          },
        }}
      >
        <DialogTitle>设置OPENROUTERKEY</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            required
            helperText="Please enter your key"
            variant="outlined"
            type='text'
            defaultValue={key}
            margin="dense"
            id="name"
            name="key"
            label="OPENROUTERKEY"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button type="submit">确认</Button>
        </DialogActions>
      </Dialog>
    </>

  );
};

export default Home;