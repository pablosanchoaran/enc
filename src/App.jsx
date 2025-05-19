import React, { useState } from 'react'

const App = () => {
  const [name, setName] = useState('')
  const [votes, setVotes] = useState({})
  const [options] = useState(['14 Junio', '21 Junio', '5 Julio'])

  const handleVote = (option) => {
    if (!name) return
    setVotes((prev) => {
      const updated = { ...prev }
      if (!updated[option]) updated[option] = []
      if (!updated[option].includes(name)) updated[option].push(name)
      return updated
    })
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h2>Día de la comida 🍽️🍺</h2>
      <input
        type="text"
        placeholder="Tu nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <ul>
        {options.map((option) => (
          <li key={option}>
            <label>
              <input
                type="checkbox"
                onChange={() => handleVote(option)}
              />
              {option} ({votes[option]?.length || 0} votos)
              <ul>
                {votes[option]?.map((voter, idx) => (
                  <li key={idx}>• {voter}</li>
                ))}
              </ul>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App