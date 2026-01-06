import './Card.css';

const Card = ({
  children,
  variant = 'default',
  hoverable = false,
  className = '',
  ...props
}) => {
  const classes = [
    'card',
    `card-${variant}`,
    hoverable && 'card-hoverable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;

