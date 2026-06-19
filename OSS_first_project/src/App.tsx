import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const COLS = 10
const ROWS = 20
const BLOCK = 30

const colors = {
  I: '#59d2ff',
  J: '#5a7dff',
  L: '#ffa447',
  O: '#f7d84b',
  S: '#55d66b',
  T: '#b76cff',
  Z: '#ff6678',
} as const

const shapes = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
} as const

type PieceType = keyof typeof shapes
type BoardCell = PieceType | null
type Board = BoardCell[][]
type Shape = number[][]

type Piece = {
  type: PieceType
  shape: Shape
  x: number
  y: number
}

type GameState = {
  board: Board
  piece: Piece
  nextPiece: Piece
  score: number
  lines: number
  level: number
  running: boolean
  paused: boolean
  message: string
  gameOver: boolean
}

const createBoard = () => Array.from({ length: ROWS }, () => Array<BoardCell>(COLS).fill(null))

const randomPiece = (): Piece => {
  const keys = Object.keys(shapes) as PieceType[]
  const type = keys[Math.floor(Math.random() * keys.length)]
  const shape = shapes[type].map((row) => [...row])

  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0,
  }
}

const rotate = (shape: Shape) => shape[0].map((_, index) => shape.map((row) => row[index]).reverse())

const collides = (board: Board, piece: Piece) =>
  piece.shape.some((row, y) =>
    row.some((cell, x) => {
      if (!cell) return false
      const nextX = piece.x + x
      const nextY = piece.y + y

      return nextX < 0 || nextX >= COLS || nextY >= ROWS || (nextY >= 0 && board[nextY][nextX])
    }),
  )

const mergePiece = (board: Board, piece: Piece) => {
  const nextBoard = board.map((row) => [...row])

  piece.shape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell && piece.y + y >= 0) {
        nextBoard[piece.y + y][piece.x + x] = piece.type
      }
    })
  })

  return nextBoard
}

const clearLines = (board: Board) => {
  let cleared = 0
  const remaining = board.filter((row) => {
    if (row.every(Boolean)) {
      cleared += 1
      return false
    }
    return true
  })

  while (remaining.length < ROWS) {
    remaining.unshift(Array<BoardCell>(COLS).fill(null))
  }

  return { board: remaining, cleared }
}

const makeInitialState = (): GameState => ({
  board: createBoard(),
  piece: randomPiece(),
  nextPiece: randomPiece(),
  score: 0,
  lines: 0,
  level: 1,
  running: false,
  paused: false,
  message: '시작 버튼을 눌러 게임을 시작하세요.',
  gameOver: false,
})

function App() {
  const boardRef = useRef<HTMLCanvasElement | null>(null)
  const nextRef = useRef<HTMLCanvasElement | null>(null)
  const dropCounterRef = useRef(0)
  const lastTimeRef = useRef(0)
  const animationRef = useRef(0)
  const [game, setGame] = useState<GameState>(() => makeInitialState())

  const drawCell = useCallback(
    (context: CanvasRenderingContext2D, x: number, y: number, color: string, size = BLOCK) => {
      context.fillStyle = color
      context.fillRect(x * size, y * size, size, size)
      context.strokeStyle = 'rgba(255, 255, 255, 0.18)'
      context.lineWidth = 2
      context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2)
    },
    [],
  )

  const draw = useCallback(() => {
    const canvas = boardRef.current
    const nextCanvas = nextRef.current
    const context = canvas?.getContext('2d')
    const nextContext = nextCanvas?.getContext('2d')

    if (!canvas || !nextCanvas || !context || !nextContext) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = 'rgba(255, 255, 255, 0.055)'
    context.lineWidth = 1

    for (let x = 0; x <= COLS; x += 1) {
      context.beginPath()
      context.moveTo(x * BLOCK, 0)
      context.lineTo(x * BLOCK, canvas.height)
      context.stroke()
    }

    for (let y = 0; y <= ROWS; y += 1) {
      context.beginPath()
      context.moveTo(0, y * BLOCK)
      context.lineTo(canvas.width, y * BLOCK)
      context.stroke()
    }

    game.board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawCell(context, x, y, colors[cell])
      })
    })

    game.piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawCell(context, game.piece.x + x, game.piece.y + y, colors[game.piece.type])
      })
    })

    nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height)
    const size = 24
    const nextShape = game.nextPiece.shape
    const offsetX = Math.floor((nextCanvas.width / size - nextShape[0].length) / 2)
    const offsetY = Math.floor((nextCanvas.height / size - nextShape.length) / 2)

    nextShape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawCell(nextContext, offsetX + x, offsetY + y, colors[game.nextPiece.type], size)
      })
    })
  }, [drawCell, game])

  const settlePiece = useCallback((current: GameState): GameState => {
    const merged = mergePiece(current.board, current.piece)
    const clearedLines = clearLines(merged)
    const totalLines = current.lines + clearedLines.cleared
    const level = Math.floor(totalLines / 10) + 1
    const score = current.score + [0, 100, 300, 500, 800][clearedLines.cleared] * current.level
    const piece = {
      ...current.nextPiece,
      x: Math.floor(COLS / 2) - Math.ceil(current.nextPiece.shape[0].length / 2),
      y: 0,
    }
    const gameOver = collides(clearedLines.board, piece)

    return {
      ...current,
      board: clearedLines.board,
      piece,
      nextPiece: randomPiece(),
      score,
      lines: totalLines,
      level,
      running: !gameOver,
      paused: false,
      message: gameOver ? '게임 오버' : '게임 진행 중',
      gameOver,
    }
  }, [])

  const move = useCallback(
    (dx: number, dy: number, reward = 0) => {
      setGame((current) => {
        if (!current.running || current.paused) return current
        const nextPiece = { ...current.piece, x: current.piece.x + dx, y: current.piece.y + dy }

        if (!collides(current.board, nextPiece)) {
          return { ...current, piece: nextPiece, score: current.score + reward }
        }

        if (dy > 0) return settlePiece(current)
        return current
      })
    },
    [settlePiece],
  )

  const rotatePiece = useCallback(() => {
    setGame((current) => {
      if (!current.running || current.paused) return current
      const rotated = { ...current.piece, shape: rotate(current.piece.shape) }

      for (const offset of [0, -1, 1, -2, 2]) {
        const kicked = { ...rotated, x: current.piece.x + offset }
        if (!collides(current.board, kicked)) return { ...current, piece: kicked }
      }

      return current
    })
  }, [])

  const hardDrop = useCallback(() => {
    setGame((current) => {
      if (!current.running || current.paused) return current
      let piece = current.piece
      let bonus = 0

      while (!collides(current.board, { ...piece, y: piece.y + 1 })) {
        piece = { ...piece, y: piece.y + 1 }
        bonus += 2
      }

      return settlePiece({ ...current, piece, score: current.score + bonus })
    })
  }, [settlePiece])

  const startGame = () => {
    dropCounterRef.current = 0
    lastTimeRef.current = 0
    setGame({ ...makeInitialState(), running: true, message: '게임 진행 중' })
  }

  const togglePause = () => {
    setGame((current) => {
      if (!current.running) return current
      return {
        ...current,
        paused: !current.paused,
        message: current.paused ? '게임 진행 중' : '일시정지됨',
      }
    })
  }

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const update = (time = 0) => {
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time

      if (game.running && !game.paused) {
        dropCounterRef.current += delta
        const speed = Math.max(130, 850 - (game.level - 1) * 70)

        if (dropCounterRef.current > speed) {
          move(0, 1)
          dropCounterRef.current = 0
        }
      }

      animationRef.current = requestAnimationFrame(update)
    }

    animationRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationRef.current)
  }, [game.level, game.paused, game.running, move])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move(-1, 0)
      if (event.key === 'ArrowRight') move(1, 0)
      if (event.key === 'ArrowDown') move(0, 1, 1)
      if (event.key === 'ArrowUp') rotatePiece()
      if (event.code === 'Space') {
        event.preventDefault()
        hardDrop()
      }
      if (event.key.toLowerCase() === 'p') togglePause()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hardDrop, move, rotatePiece])

  return (
    <>
      <header className="top-bar">
        <h1>Tetris</h1>
        <button className="login-button" type="button" aria-label="로그인">
          로그인
        </button>
      </header>

      <main className="game-shell">
        <section className="game-layout" aria-label="테트리스 게임">
          <div className="board-wrap">
            <canvas ref={boardRef} width="300" height="600" />
          </div>

          <aside className="side">
            <div className="panel stats">
              <div className="stat">
                <span className="label">Score</span>
                <span className="value">{game.score}</span>
              </div>
              <div className="stat">
                <span className="label">Lines</span>
                <span className="value">{game.lines}</span>
              </div>
              <div className="stat">
                <span className="label">Level</span>
                <span className="value">{game.level}</span>
              </div>
            </div>

            <div className="panel next-box">
              <canvas ref={nextRef} width="112" height="112" />
              <p className={game.gameOver ? 'status game-over' : 'status'}>{game.message}</p>
            </div>

            <div className="actions">
              <button className="primary" type="button" onClick={startGame}>
                시작
              </button>
              <button type="button" onClick={togglePause}>
                {game.paused ? '계속하기' : '일시정지'}
              </button>
            </div>

            <div className="touch-controls" aria-label="모바일 조작">
              <button type="button" onClick={() => move(-1, 0)} aria-label="왼쪽">
                ←
              </button>
              <button type="button" onClick={rotatePiece} aria-label="회전">
                ↻
              </button>
              <button type="button" onClick={() => move(1, 0)} aria-label="오른쪽">
                →
              </button>
              <button type="button" onClick={() => move(0, 1, 1)} aria-label="아래">
                ↓
              </button>
              <button type="button" onClick={hardDrop} aria-label="내리기">
                ⤓
              </button>
            </div>

            <div className="panel">
              <p className="keys">키보드: ← → 이동, ↑ 회전, ↓ 빠르게 내리기, Space 즉시 내리기, P 일시정지</p>
            </div>
          </aside>
        </section>
      </main>
    </>
  )
}

export default App
