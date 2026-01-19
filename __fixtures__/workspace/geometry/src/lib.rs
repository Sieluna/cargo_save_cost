#![no_std]

use vector_distance::{vector_distance_2d, vector_mean_2d};
use vector_sub::sub_vector_2d;
use vector_types::Vector2;

pub struct Point2D {
    pub position: Vector2,
}

pub struct Line2D {
    pub start: Vector2,
    pub end: Vector2,
}

pub struct Triangle2D {
    pub p1: Vector2,
    pub p2: Vector2,
    pub p3: Vector2,
}

pub struct Rectangle2D {
    pub top_left: Vector2,
    pub bottom_right: Vector2,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Point2D {
            position: Vector2::new(x, y),
        }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        vector_distance_2d(self.position, other.position)
    }
}

impl Line2D {
    pub fn new(start_x: f64, start_y: f64, end_x: f64, end_y: f64) -> Self {
        Line2D {
            start: Vector2::new(start_x, start_y),
            end: Vector2::new(end_x, end_y),
        }
    }

    pub fn length(&self) -> f64 {
        vector_distance_2d(self.start, self.end)
    }

    pub fn midpoint(&self) -> Vector2 {
        vector_mean_2d(self.start, self.end)
    }
}

impl Triangle2D {
    pub fn new(p1: Vector2, p2: Vector2, p3: Vector2) -> Self {
        Triangle2D { p1, p2, p3 }
    }

    pub fn perimeter(&self) -> f64 {
        vector_distance_2d(self.p1, self.p2)
            + vector_distance_2d(self.p2, self.p3)
            + vector_distance_2d(self.p3, self.p1)
    }

    pub fn area(&self) -> f64 {
        // Using the cross product formula for triangle area
        let side1 = sub_vector_2d(self.p2, self.p1);
        let side2 = sub_vector_2d(self.p3, self.p1);

        // Cross product magnitude divided by 2
        ((side1.x * side2.y - side1.y * side2.x).abs()) / 2.0
    }
}

impl Rectangle2D {
    pub fn new(top_left: Vector2, bottom_right: Vector2) -> Self {
        Rectangle2D {
            top_left,
            bottom_right,
        }
    }

    pub fn width(&self) -> f64 {
        (self.bottom_right.x - self.top_left.x).abs()
    }

    pub fn height(&self) -> f64 {
        (self.bottom_right.y - self.top_left.y).abs()
    }

    pub fn area(&self) -> f64 {
        self.width() * self.height()
    }

    pub fn perimeter(&self) -> f64 {
        2.0 * (self.width() + self.height())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_line_properties() {
        let line = Line2D::new(0.0, 0.0, 3.0, 4.0);
        assert!((line.length() - 5.0).abs() < 1e-10);
        assert_eq!(line.midpoint(), Vector2::new(1.5, 2.0));
    }

    #[test]
    fn test_triangle_area_and_perimeter() {
        let tri = Triangle2D::new(
            Vector2::new(0.0, 0.0),
            Vector2::new(4.0, 0.0),
            Vector2::new(0.0, 3.0),
        );
        assert!((tri.area() - 6.0).abs() < 1e-10);
        assert!((tri.perimeter() - 12.0).abs() < 1e-10); // 4 + 3 + 5 = 12
    }

    #[test]
    fn test_rectangle_properties() {
        let rect = Rectangle2D::new(Vector2::new(0.0, 0.0), Vector2::new(4.0, 3.0));
        assert_eq!(rect.width(), 4.0);
        assert_eq!(rect.height(), 3.0);
        assert_eq!(rect.area(), 12.0);
        assert_eq!(rect.perimeter(), 14.0);
    }
}
